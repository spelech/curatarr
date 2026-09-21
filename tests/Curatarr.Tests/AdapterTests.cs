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

    [Fact]
    public async Task TautulliClient_GetHistory_ShouldParseStringAndNumberFieldsCorrectly()
    {
        var json = @"{
            ""response"": {
                ""result"": ""success"",
                ""data"": {
                    ""recordsFiltered"": 1,
                    ""recordsTotal"": 1,
                    ""data"": [
                        {
                            ""rating_key"": ""12033"",
                            ""grandparent_rating_key"": ""38587"",
                            ""parent_rating_key"": ""38588"",
                            ""title"": ""Harry Potter and the Goblet of Fire"",
                            ""grandparent_title"": """",
                            ""user_id"": 10860036,
                            ""user"": ""npel8"",
                            ""parent_media_index"": ""2"",
                            ""date"": 1634088068,
                            ""media_type"": ""movie"",
                            ""year"": ""2005""
                        }
                    ]
                }
            }
        }";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("cmd=get_history");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new TautulliClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://tautulli:8181", ApiKey = "testkey" };

        var history = await client.GetHistoryAsync(conn, length: 1);
        history.Should().HaveCount(1);
        var item = history[0];
        item.RatingKey.Should().Be(12033);
        item.GrandparentRatingKey.Should().Be("38587");
        item.Title.Should().Be("Harry Potter and the Goblet of Fire");
        item.UserId.Should().Be("10860036");
        item.Username.Should().Be("npel8");
        item.SeasonNumber.Should().Be(2);
        item.Year.Should().Be(2005);
        item.MediaType.Should().Be("movie");
    }

    [Fact]
    public async Task PlexClient_GetSectionItems_ShouldFallbackToViewedLeafCount()
    {
        var json = @"{
            ""MediaContainer"": {
                ""Metadata"": [
                    {
                        ""ratingKey"": ""32711"",
                        ""title"": ""3 Body Problem"",
                        ""type"": ""show"",
                        ""year"": 2024,
                        ""viewCount"": 0,
                        ""viewedLeafCount"": 4,
                        ""lastViewedAt"": 1712528694
                    }
                ]
            }
        }";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("/library/sections/2/all");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new PlexClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://plex:32400", ApiKey = "plextoken" };

        var items = await client.GetSectionItemsAsync(conn, "2");
        items.Should().HaveCount(1);
        var show = items[0];
        show.RatingKey.Should().Be(32711);
        show.Title.Should().Be("3 Body Problem");
        show.ViewCount.Should().Be(4); // from viewedLeafCount
        show.LastViewedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RadarrClient_GetCutoffUnmetMovieIds_ShouldParseIds()
    {
        var json = @"{
            ""records"": [
                { ""id"": 101 },
                { ""id"": 102 }
            ]
        }";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("/api/v3/wanted/cutoff");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new RadarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://radarr:7878", ApiKey = "radarrapikey" };

        var ids = await client.GetCutoffUnmetMovieIdsAsync(conn);
        ids.Should().BeEquivalentTo([101, 102]);
    }

    [Fact]
    public async Task RadarrClient_GetMovies_ShouldParseMovies()
    {
        var json = @"[
            {
                ""id"": 5,
                ""title"": ""Dune Part Two"",
                ""sortTitle"": ""dune part two"",
                ""tmdbId"": 693134,
                ""imdbId"": ""tt15239678"",
                ""year"": 2024,
                ""monitored"": true,
                ""hasFile"": true,
                ""sizeOnDisk"": 32000000000,
                ""movieFile"": { ""mediaInfo"": { ""resolution"": ""3840x2160"" } }
            }
        ]";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("/api/v3/movie");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new RadarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://radarr:7878", ApiKey = "key" };

        var movies = await client.GetMoviesAsync(conn);
        movies.Should().HaveCount(1);
        movies[0].Title.Should().Be("Dune Part Two");
        movies[0].SizeOnDisk.Should().Be(32000000000);
        movies[0].HasFile.Should().BeTrue();
    }

    [Fact]
    public async Task SonarrClient_DeleteSeries_And_EpisodeFiles_ShouldSendCorrectDeleteCalls()
    {
        bool seriesDeleted = false;
        bool filesDeleted = false;

        var handler = new MockHandler(req =>
        {
            if (req.Method == HttpMethod.Delete && req.RequestUri!.PathAndQuery.Contains("/api/v3/series/10"))
            {
                seriesDeleted = true;
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            if (req.Method == HttpMethod.Delete && req.RequestUri!.PathAndQuery.Contains("/api/v3/episodefile/"))
            {
                filesDeleted = true;
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new SonarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "sonarrapi" };

        await client.DeleteSeriesAsync(conn, 10, deleteFiles: true, addImportExclusion: true);
        seriesDeleted.Should().BeTrue();

        await client.DeleteEpisodeFilesAsync(conn, [1001, 1002]);
        filesDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task SonarrClient_GetCutoffUnmetSeriesIds_ShouldParseIds()
    {
        var json = @"{
            ""records"": [
                { ""seriesId"": 201 },
                { ""seriesId"": 202 }
            ]
        }";

        var handler = new MockHandler(req =>
        {
            req.RequestUri!.PathAndQuery.Should().Contain("/api/v3/wanted/cutoff");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        });

        var client = new SonarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "sonarrapi" };

        var ids = await client.GetCutoffUnmetSeriesIdsAsync(conn);
        ids.Should().BeEquivalentTo([201, 202]);
    }

    [Fact]
    public async Task PlexClient_GetSections_And_Refresh_ShouldExecuteCorrectly()
    {
        var sectionsJson = @"{
            ""MediaContainer"": {
                ""Directory"": [
                    { ""key"": ""1"", ""type"": ""movie"", ""title"": ""Movies"" },
                    { ""key"": ""2"", ""type"": ""show"", ""title"": ""TV Shows"" }
                ]
            }
        }";

        bool refreshed = false;

        var handler = new MockHandler(req =>
        {
            if (req.RequestUri!.PathAndQuery.Contains("/library/sections/1/refresh"))
            {
                refreshed = true;
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            if (req.RequestUri!.PathAndQuery.Contains("/library/sections"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(sectionsJson) };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new PlexClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://plex:32400", ApiKey = "token" };

        var sections = await client.GetSectionsAsync(conn);
        sections.Should().HaveCount(2);
        sections[0].Title.Should().Be("Movies");

        await client.RefreshSectionAsync(conn, "1");
        refreshed.Should().BeTrue();
    }

    [Fact]
    public async Task OverseerrClient_GetRequests_And_Delete_ShouldExecuteCorrectly()
    {
        var requestsJson = @"{
            ""results"": [
                {
                    ""id"": 42,
                    ""status"": 2,
                    ""type"": ""movie"",
                    ""media"": { ""tmdbId"": 550, ""tvdbId"": null, ""status"": 5 }
                }
            ]
        }";

        bool requestDeleted = false;

        var handler = new MockHandler(req =>
        {
            if (req.Method == HttpMethod.Delete && req.RequestUri!.PathAndQuery.Contains("/api/v1/request/42"))
            {
                requestDeleted = true;
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            if (req.RequestUri!.PathAndQuery.Contains("/api/v1/request"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(requestsJson) };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new OverseerrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://overseerr:5055", ApiKey = "overseerrapi" };

        var reqs = await client.GetRequestsAsync(conn);
        reqs.Should().HaveCount(1);
        reqs[0].Id.Should().Be(42);

        await client.DeleteRequestAsync(conn, 42);
        requestDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task ConnectionTester_ShouldHandleSuccessAndFailures()
    {
        var handler = new MockHandler(req =>
        {
            if (req.RequestUri!.Host == "healthy")
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""version"": ""3.0.0""}") };
            }
            return new HttpResponseMessage(HttpStatusCode.Unauthorized);
        });

        var tester = new ConnectionTester(new HttpClient(handler));

        var okConn = new ServiceConnection
        {
            ConnectionType = ConnectionType.Radarr,
            BaseUrl = "http://healthy:7878",
            ApiKey = "valid"
        };
        var failConn = new ServiceConnection
        {
            ConnectionType = ConnectionType.Radarr,
            BaseUrl = "http://unhealthy:7878",
            ApiKey = "invalid"
        };

        var okResult = await tester.TestAsync(okConn);
        okResult.Success.Should().BeTrue();

        var failResult = await tester.TestAsync(failConn);
        failResult.Success.Should().BeFalse();
    }

    [Fact]
    public async Task SonarrClient_GetEpisodeFiles_And_UnmonitorSeason_ShouldWork()
    {
        var episodeFilesJson = @"[
            { ""id"": 99, ""seriesId"": 1, ""seasonNumber"": 1, ""size"": 500000000, ""mediaInfo"": { ""videoCodec"": ""h264"" } }
        ]";

        var seriesJson = @"{
            ""id"": 1,
            ""title"": ""Show"",
            ""seasons"": [
                { ""seasonNumber"": 1, ""monitored"": true }
            ]
        }";

        var handler = new MockHandler(req =>
        {
            if (req.Method == HttpMethod.Get && req.RequestUri!.PathAndQuery.Contains("/api/v3/episodefile?seriesId=1"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(episodeFilesJson) };
            }
            if (req.Method == HttpMethod.Get && req.RequestUri!.PathAndQuery.Contains("/api/v3/series/1"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(seriesJson) };
            }
            if (req.Method == HttpMethod.Put && req.RequestUri!.PathAndQuery.Contains("/api/v3/series"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(seriesJson) };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new SonarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "api" };

        var files = await client.GetEpisodeFilesAsync(conn, 1);
        files.Should().HaveCount(1);
        files[0].Id.Should().Be(99);

        await client.UnmonitorSeasonAsync(conn, 1, 1);
    }
}
