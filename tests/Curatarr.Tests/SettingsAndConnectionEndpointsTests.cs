using System.Net;
using System.Net.Http.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Curatarr.Tests;

public class SettingsAndConnectionEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SettingsAndConnectionEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var testDb = Path.Combine(Path.GetTempPath(), $"curatarr_settings_test_{Guid.NewGuid():N}.db");
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={testDb}"));
            });
        });
    }

    [Fact]
    public async Task SettingsEndpoints_GetAndPut_ShouldUpdateSettings()
    {
        using var scope = _factory.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.InitializeAsync();

        var client = _factory.CreateClient();

        // 1. GET settings
        var getRes = await client.GetAsync("/api/v1/settings");
        getRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var current = await getRes.Content.ReadFromJsonAsync<CuratarrSettings>();
        current.Should().NotBeNull();

        // 2. PUT settings with new thresholds
        var updatedSettings = current! with
        {
            NeverWatchedMinAgeDays = 90,
            StaleDays = 180,
            CatalogBatchSize = 100
        };

        var putRes = await client.PutAsJsonAsync("/api/v1/settings", updatedSettings);
        putRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. GET verify updated
        var verifyRes = await client.GetAsync("/api/v1/settings");
        var verified = await verifyRes.Content.ReadFromJsonAsync<CuratarrSettings>();
        verified!.NeverWatchedMinAgeDays.Should().Be(90);
        verified.StaleDays.Should().Be(180);
        verified.CatalogBatchSize.Should().Be(100);
    }

    [Fact]
    public async Task ConnectionEndpoints_CrudOperations_ShouldPersistAndManage()
    {
        using var scope = _factory.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.InitializeAsync();

        var client = _factory.CreateClient();

        // 1. Create connection
        var newConn = new ServiceConnection
        {
            Id = "test-radarr-conn",
            Name = "Radarr Main",
            ConnectionType = ConnectionType.Radarr,
            BaseUrl = "http://radarr:7878",
            ApiKey = "testapikey123",
            TierTag = "4K",
            IsEnabled = true
        };

        var postRes = await client.PostAsJsonAsync("/api/v1/connections", newConn);
        postRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. List connections
        var listRes = await client.GetFromJsonAsync<List<ServiceConnection>>("/api/v1/connections");
        listRes.Should().NotBeNull();
        listRes!.Should().Contain(c => c.Id == "test-radarr-conn");

        // 3. Update connection
        var updatedConn = new ServiceConnection
        {
            Id = newConn.Id,
            Name = "Radarr Updated",
            ConnectionType = newConn.ConnectionType,
            BaseUrl = newConn.BaseUrl,
            ApiKey = newConn.ApiKey,
            TierTag = "HD",
            IsEnabled = newConn.IsEnabled
        };
        var putRes = await client.PostAsJsonAsync("/api/v1/connections", updatedConn);
        putRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. Test connection endpoint (will return result object)
        var testRes = await client.PostAsJsonAsync("/api/v1/connections/test", updatedConn);
        testRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Delete connection
        var delRes = await client.DeleteAsync("/api/v1/connections/test-radarr-conn");
        delRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyList = await client.GetFromJsonAsync<List<ServiceConnection>>("/api/v1/connections");
        verifyList!.Should().NotContain(c => c.Id == "test-radarr-conn");
    }
}
