using Npgsql;

internal sealed class ExpiryWorker(NpgsqlDataSource database, ILogger<ExpiryWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        do
        {
            try
            {
                await using var command = database.CreateCommand("SELECT admission.expire_due()");
                await command.ExecuteScalarAsync(stoppingToken);
            }
            catch (NpgsqlException error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(error, "Expiry sweep failed. A later sweep will retry.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
