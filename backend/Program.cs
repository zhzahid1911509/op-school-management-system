using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
var connectionString = builder.Configuration.GetConnectionString("Admission")
    ?? throw new InvalidOperationException("Set ConnectionStrings__Admission.");
var duration = builder.Configuration.GetValue("HOLD_DURATION_SECONDS", 600);
if (duration <= 0)
    throw new InvalidOperationException("HOLD_DURATION_SECONDS must be a positive integer.");

builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
builder.Services.AddHostedService<ExpiryWorker>();
var origin = builder.Configuration["FrontendOrigin"] ?? "http://localhost:3000";
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(origin).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.Use(ApiErrors.Handle);
app.MapAdmissions(duration);
var database = app.Services.GetRequiredService<NpgsqlDataSource>();
var migration = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Database", "reservations.sql"));
await using (var setup = database.CreateCommand(migration))
    await setup.ExecuteNonQueryAsync();

app.MapGet("/health", async (CancellationToken cancellation) =>
{
    try
    {
        await using var probe = database.CreateCommand("SELECT 1");
        await probe.ExecuteScalarAsync(cancellation);
        return Results.Ok(new { status = "ready", database = "connected", holdDurationSeconds = duration });
    }
    catch (NpgsqlException)
    {
        return Results.Json(new { status = "unavailable" }, statusCode: 503);
    }
});
app.Run();
