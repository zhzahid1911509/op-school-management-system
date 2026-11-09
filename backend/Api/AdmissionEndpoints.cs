using Microsoft.Extensions.Primitives;
using Npgsql;

internal sealed record CreateClass(string? Name, int TotalSeats);
internal sealed record ClassSeats(Guid Id, string Name, int TotalSeats, long HeldSeats,
    long ConfirmedSeats, long AvailableSeats);

internal static class AdmissionEndpoints
{
    public static void MapAdmissions(this WebApplication app, int holdSeconds)
    {
        app.MapPost("/classes", Create);
        app.MapGet("/classes", async (NpgsqlDataSource db, CancellationToken ct) =>
            Results.Ok(await Classes(db, null, ct)));
        app.MapGet("/classes/{classId}", async (Guid classId, NpgsqlDataSource db, CancellationToken ct) =>
        {
            var rows = await Classes(db, classId, ct);
            return rows.Count == 0 ? Results.NotFound(new { error = "Class not found." }) : Results.Ok(rows[0]);
        });
        app.MapPost("/classes/{classId}/holds", async (Guid classId, HttpRequest request, NpgsqlDataSource db, CancellationToken ct) =>
        {
            var student = Student(request);
            await using var cmd = db.CreateCommand("""
                SELECT id, status, expires_at FROM admission.reserve(@class, @student, @seconds)
                """);
            cmd.Parameters.AddWithValue("class", classId);
            cmd.Parameters.AddWithValue("student", student);
            cmd.Parameters.AddWithValue("seconds", holdSeconds);
            await using var row = await cmd.ExecuteReaderAsync(ct);
            await row.ReadAsync(ct);
            var holdId = row.GetGuid(0);
            return Results.Created($"/holds/{holdId}", new { holdId, classId, studentId = student,
                status = row.GetString(1), expiresAt = row.GetDateTime(2) });
        });
        app.MapGet("/holds/{holdId}", Hold);
        app.MapPost("/holds/{holdId}/confirm", (Guid holdId, HttpRequest request, NpgsqlDataSource db, CancellationToken ct) =>
            Transition(db, holdId, Student(request), "CONFIRMED", ct));
        app.MapDelete("/holds/{holdId}", (Guid holdId, HttpRequest request, NpgsqlDataSource db, CancellationToken ct) =>
            Transition(db, holdId, Student(request), "CANCELLED", ct));
        app.MapGet("/me/holds", History);
    }

    private static string Student(HttpRequest request)
    {
        StringValues values = request.Headers["X-Student-Id"];
        var id = values.Count == 1 ? values[0] : null;
        if (id is null || id.Length != 17 || !id.All(char.IsAsciiDigit))
            throw new BadHttpRequestException("X-Student-Id must contain exactly 17 digits.");
        return id;
    }

    private static async Task<IResult> Create(CreateClass input, NpgsqlDataSource db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Contains('\0') || input.TotalSeats <= 0)
            return Results.BadRequest(new { error = "Provide a class name and a positive seat count." });
        var name = input.Name.Trim();
        await using var cmd = db.CreateCommand("""
            INSERT INTO admission.classes(name, total_seats) VALUES (@name, @seats) RETURNING id
            """);
        cmd.Parameters.AddWithValue("name", name);
        cmd.Parameters.AddWithValue("seats", input.TotalSeats);
        var id = (Guid)(await cmd.ExecuteScalarAsync(ct))!;
        return Results.Created($"/classes/{id}", new { id, name, input.TotalSeats });
    }

    private static async Task<List<ClassSeats>> Classes(NpgsqlDataSource db, Guid? classId, CancellationToken ct)
    {
        const string select = """
            SELECT id, name, total_seats, held_seats, confirmed_seats, available_seats
            FROM admission.class_availability
            """;
        await using var cmd = db.CreateCommand(select + (classId.HasValue ? " WHERE id = @id" : " ORDER BY name, id"));
        if (classId.HasValue) cmd.Parameters.AddWithValue("id", classId.Value);
        var classes = new List<ClassSeats>();
        await using var row = await cmd.ExecuteReaderAsync(ct);
        while (await row.ReadAsync(ct))
            classes.Add(new(row.GetGuid(0), row.GetString(1), row.GetInt32(2),
                row.GetInt64(3), row.GetInt64(4), row.GetInt64(5)));
        return classes;
    }

    private static async Task<IResult> Hold(Guid holdId, NpgsqlDataSource db, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("""
            SELECT class_id, status, expires_at FROM admission.application_status WHERE id = @id
            """);
        cmd.Parameters.AddWithValue("id", holdId);
        await using var row = await cmd.ExecuteReaderAsync(ct);
        if (!await row.ReadAsync(ct)) return Results.NotFound(new { error = "Application not found." });
        return Results.Ok(new { holdId, classId = row.GetGuid(0), status = row.GetString(1), expiresAt = row.GetDateTime(2) });
    }

    private static async Task<IResult> Transition(NpgsqlDataSource db, Guid holdId, string student, string target, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("SELECT status FROM admission.transition(@id, @student, @target)");
        cmd.Parameters.AddWithValue("id", holdId);
        cmd.Parameters.AddWithValue("student", student);
        cmd.Parameters.AddWithValue("target", target);
        var status = (string)(await cmd.ExecuteScalarAsync(ct))!;
        return target == "CANCELLED" ? Results.NoContent() : Results.Ok(new { holdId, status });
    }

    private static async Task<IResult> History(HttpRequest request, NpgsqlDataSource db, CancellationToken ct)
    {
        var student = Student(request);
        await using var cmd = db.CreateCommand("""
            SELECT h.id, h.class_id, c.name, h.status, h.expires_at
            FROM admission.application_status h JOIN admission.classes c ON c.id = h.class_id
            WHERE h.student_id = @student ORDER BY h.expires_at DESC, h.id
            """);
        cmd.Parameters.AddWithValue("student", student);
        await using var row = await cmd.ExecuteReaderAsync(ct);
        var history = new List<object>();
        while (await row.ReadAsync(ct))
            history.Add(new { holdId = row.GetGuid(0), classId = row.GetGuid(1), className = row.GetString(2),
                status = row.GetString(3), expiresAt = row.GetDateTime(4) });
        return Results.Ok(history);
    }
}
