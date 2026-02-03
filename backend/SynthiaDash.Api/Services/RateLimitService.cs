using System.Collections.Concurrent;

namespace SynthiaDash.Api.Services;

public interface IRateLimitService
{
    bool IsRateLimited(string key, int maxAttempts, TimeSpan window);
    void RecordAttempt(string key);
    void Reset(string key);
}

public class RateLimitService : IRateLimitService
{
    private readonly ConcurrentDictionary<string, List<DateTime>> _attempts = new();

    public bool IsRateLimited(string key, int maxAttempts, TimeSpan window)
    {
        CleanupExpired(key, window);

        if (_attempts.TryGetValue(key, out var attempts))
        {
            lock (attempts)
            {
                return attempts.Count >= maxAttempts;
            }
        }

        return false;
    }

    public void RecordAttempt(string key)
    {
        var attempts = _attempts.GetOrAdd(key, _ => new List<DateTime>());
        lock (attempts)
        {
            attempts.Add(DateTime.UtcNow);
        }
    }

    public void Reset(string key)
    {
        _attempts.TryRemove(key, out _);
    }

    private void CleanupExpired(string key, TimeSpan window)
    {
        if (_attempts.TryGetValue(key, out var attempts))
        {
            var cutoff = DateTime.UtcNow - window;
            lock (attempts)
            {
                attempts.RemoveAll(t => t < cutoff);
            }
        }
    }
}
