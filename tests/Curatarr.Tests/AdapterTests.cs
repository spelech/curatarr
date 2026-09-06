using System.Net;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Infrastructure.Adapters;
using FluentAssertions;

namespace Curatarr.Tests;

public class AdapterTests
{
    private class MockHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public MockHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_responder(request));
        }
    }

    [Fact]
    public async Task SonarrClient_GetSeries_ShouldParseCorrectly()
    {
        var json = @"[
            {
                ""id"": 10,
                ""title"": ""Severance"",
                ""sortTitle"": ""severance"",
                ""tvdbId"": 371980,
                ""imdbId"": ""tt11280740"",
                ""year"": 2022,
                ""monitored"": true,
                ""path"": ""/tv/Severance"",
                ""statistics"": {
                    ""sizeOnDisk"": 45000000000,
                    ""episodeFileCount"": 9,
                    ""totalEpisodeCount"": 9
                },
                ""seasons"": [
                    {
                        ""seasonNumber"": 1,
                        ""monitored"": true,
                        ""statistics"": {
                            ""sizeOnDisk"": 45000000000,
                            ""episodeFileCount"": 9,
                            ""totalEpisodeCount"": 9
                        }
                    }
                ],
                ""qualityProfileId"": 1
            }
        ]";

        var handler = new MockHandler(req =>
        {
            req.Headers.GetValues("X-Api-Key").Should().Contain("testkey");
            req.RequestUri!.PathAndQuery.Should().Contain("/api/v3/series");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new SonarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "testkey" };

        var series = await client.GetSeriesAsync(conn);
        series.Should().HaveCount(1);
        series[0].Title.Should().Be("Severance");
        series[0].TvdbId.Should().Be(371980);
        series[0].SizeOnDisk.Should().Be(45000000000);
        series[0].Seasons.Should().HaveCount(1);
        series[0].Seasons[0].SeasonNumber.Should().Be(1);
    }

    [Fact]
    public async Task RadarrClient_DeleteMovie_ShouldPassExclusionFlag()
    {
        HttpRequestMessage? captured = null;
        var handler = new MockHandler(req =>
        {
            captured = req;
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        });

        var client = new RadarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://radarr:7878", ApiKey = "radarrkey" };

        await client.DeleteMovieAsync(conn, 42, deleteFiles: true, addImportExclusion: true);

        captured.Should().NotBeNull();
        captured!.Method.Should().Be(HttpMethod.Delete);
        captured.RequestUri!.PathAndQuery.Should().Be("/api/v3/movie/42?deleteFiles=true&addImportExclusion=true");
    }

    [Fact]
    public async Task TautulliClient_GetUsers_ShouldParseUsers()
    {
        var json = @"{
            ""response"": {
                ""result"": ""success"",
                ""data"": [
                    {
                        ""user_id"": 12345,
                        ""username"": ""steve"",
                        ""friendly_name"": ""Steve""
                    }
                ]
            }
        }";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("cmd=get_users");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new TautulliClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://tautulli:8181", ApiKey = "tautullikey" };

        var users = await client.GetUsersAsync(conn);
        users.Should().HaveCount(1);
        users[0].Username.Should().Be("steve");
        users[0].UserId.Should().Be("12345");
    }

    [Fact]
    public async Task ConnectionTester_ShouldReturnSuccess_WhenStatusEndpointReturnsOk()
    {
        var handler = new MockHandler(req =>
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(@"{""version"": ""3.0.10.1567""}")
            };
        });

        var tester = new ConnectionTester(new HttpClient(handler));
        var conn = new ServiceConnection
        {
            ConnectionType = ConnectionType.Sonarr,
            BaseUrl = "http://sonarr:8989",
            ApiKey = "key"
        };

        var result = await tester.TestAsync(conn);
        result.Success.Should().BeTrue();
        result.Version.Should().Be("3.0.10.1567");
    }
}
