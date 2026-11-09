using Npgsql;

internal static class ApiErrors
{
    public static async Task Handle(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (BadHttpRequestException ex)
        {
            await Write(context, ex.StatusCode, ex.Message.Contains("X-Student-Id")
                ? ex.Message : "Check the request URL, content type and JSON fields.");
        }
        catch (PostgresException ex) when (ex.SqlState is "A0400" or "A0403" or "A0404" or "A0409")
        {
            await Write(context, int.Parse(ex.SqlState[2..]), ex.MessageText);
        }
        catch (NpgsqlException ex) when (ex.IsTransient)
        {
            await Write(context, 503, "The admission database is temporarily unavailable.");
        }
    }

    private static Task Write(HttpContext context, int status, string error)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new { error });
    }
}
