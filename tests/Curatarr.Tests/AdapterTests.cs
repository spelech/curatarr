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

    [Fact]
    public async Task ConnectionTester_Comprehensive_AllConnectionTypesAndErrorBranches()
    {
        var handler = new MockHandler(req =>
        {
            var host = req.RequestUri!.Host;
            var path = req.RequestUri!.PathAndQuery;

            if (host == "exception") throw new HttpRequestException("DNS lookup failed");
            if (host == "unauthorized") return new HttpResponseMessage(HttpStatusCode.Unauthorized);

            if (host == "sonarr")
            {
                if (path.Contains("noversion")) return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""version"": ""4.0.0""}") };
            }
            if (host == "tautulli")
            {
                if (path.Contains("error-msg"))
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""response"": {""result"": ""error"", ""message"": ""Invalid API key""}}") };
                if (path.Contains("error-nomsg"))
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""response"": {""result"": ""error""}}") };
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""response"": {""result"": ""success""}}") };
            }
            if (host == "plex")
            {
                if (path.Contains("noversion"))
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""MediaContainer"": {}}") };
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""MediaContainer"": {""version"": ""1.32.0""}}") };
            }
            if (host == "overseerr")
            {
                if (path.Contains("noversion"))
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""version"": ""1.33.2""}") };
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var tester = new ConnectionTester(new HttpClient(handler));

        // Sonarr
        var sonarrRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Sonarr, BaseUrl = "http://sonarr:8989", ApiKey = "k" });
        sonarrRes.Success.Should().BeTrue();
        sonarrRes.Version.Should().Be("4.0.0");

        var sonarrNoVerRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Sonarr, BaseUrl = "http://sonarr:8989/noversion", ApiKey = "k" });
        sonarrNoVerRes.Success.Should().BeTrue();
        sonarrNoVerRes.Version.Should().BeNull();

        // Tautulli
        var tautulliRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Tautulli, BaseUrl = "http://tautulli:8181", ApiKey = "k" });
        tautulliRes.Success.Should().BeTrue();

        var tautulliErrRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Tautulli, BaseUrl = "http://tautulli:8181/error-msg", ApiKey = "k" });
        tautulliErrRes.Success.Should().BeFalse();
        tautulliErrRes.Message.Should().Contain("Invalid API key");

        var tautulliErrNoMsgRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Tautulli, BaseUrl = "http://tautulli:8181/error-nomsg", ApiKey = "k" });
        tautulliErrNoMsgRes.Success.Should().BeFalse();
        tautulliErrNoMsgRes.Message.Should().Be("Tautulli error");

        var tautulliHttpErr = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Tautulli, BaseUrl = "http://unauthorized:8181", ApiKey = "k" });
        tautulliHttpErr.Success.Should().BeFalse();

        // Plex
        var plexRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Plex, BaseUrl = "http://plex:32400", ApiKey = "k" });
        plexRes.Success.Should().BeTrue();
        plexRes.Version.Should().Be("1.32.0");

        var plexNoVerRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Plex, BaseUrl = "http://plex:32400/noversion", ApiKey = "k" });
        plexNoVerRes.Success.Should().BeTrue();
        plexNoVerRes.Version.Should().Be("Plex Media Server");

        var plexHttpErr = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Plex, BaseUrl = "http://unauthorized:32400", ApiKey = "k" });
        plexHttpErr.Success.Should().BeFalse();

        // Overseerr
        var overseerrRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Overseerr, BaseUrl = "http://overseerr:5055", ApiKey = "k" });
        overseerrRes.Success.Should().BeTrue();
        overseerrRes.Version.Should().Be("1.33.2");

        var overseerrNoVerRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Overseerr, BaseUrl = "http://overseerr:5055/noversion", ApiKey = "k" });
        overseerrNoVerRes.Success.Should().BeTrue();
        overseerrNoVerRes.Version.Should().BeNull();

        var overseerrHttpErr = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Overseerr, BaseUrl = "http://unauthorized:5055", ApiKey = "k" });
        overseerrHttpErr.Success.Should().BeFalse();

        // Unsupported type
        var unsupportedRes = await tester.TestAsync(new ServiceConnection { ConnectionType = (ConnectionType)999, BaseUrl = "http://dummy", ApiKey = "k" });
        unsupportedRes.Success.Should().BeFalse();
        unsupportedRes.Message.Should().Contain("Unknown connection type");

        // Exception thrown
        var exceptionRes = await tester.TestAsync(new ServiceConnection { ConnectionType = ConnectionType.Sonarr, BaseUrl = "http://exception:8989", ApiKey = "k" });
        exceptionRes.Success.Should().BeFalse();
        exceptionRes.Message.Should().Contain("DNS lookup failed");
    }

    [Fact]
    public async Task RadarrClient_ResolutionAndPosterVariants_ShouldCoverAllBranches()
    {
        var moviesJson = @"[
            {
                ""id"": 1,
                ""title"": ""Movie 4K"",
                ""hasFile"": true,
                ""added"": ""2024-01-15T12:00:00Z"",
                ""movieFile"": {
                    ""quality"": {
                        ""quality"": { ""resolution"": 2160, ""name"": ""Remux-2160p"" }
                    }
                },
                ""images"": [
                    { ""coverType"": ""poster"", ""remoteUrl"": ""http://img/original/poster1.jpg"" }
                ]
            },
            {
                ""id"": 2,
                ""title"": ""Movie 1080p"",
                ""hasFile"": true,
                ""added"": ""invalid-date"",
                ""movieFile"": {
                    ""quality"": {
                        ""quality"": { ""resolution"": 1080, ""name"": ""Bluray-1080p"" }
                    }
                },
                ""images"": [
                    { ""coverType"": ""banner"", ""remoteUrl"": ""http://img/banner.jpg"" },
                    { ""coverType"": ""poster"", ""remoteUrl"": """" }
                ]
            },
            {
                ""id"": 3,
                ""title"": ""Movie 720p"",
                ""hasFile"": true,
                ""movieFile"": {
                    ""quality"": {
                        ""quality"": { ""resolution"": 720, ""name"": ""HDTV-720p"" }
                    }
                }
            },
            {
                ""id"": 4,
                ""title"": ""Movie SD"",
                ""hasFile"": true,
                ""movieFile"": {
                    ""quality"": {
                        ""quality"": { ""resolution"": 480, ""name"": ""DVD"" }
                    }
                }
            },
            {
                ""id"": 5,
                ""title"": ""Movie No File"",
                ""hasFile"": false
            }
        ]";

        var handler = new MockHandler(req =>
        {
            if (req.Method == HttpMethod.Get && req.RequestUri!.PathAndQuery.Contains("/api/v3/movie"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(moviesJson) };
            }
            if (req.Method == HttpMethod.Delete && req.RequestUri!.PathAndQuery.Contains("/api/v3/movie/1"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new RadarrClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://radarr:7878", ApiKey = "api" };

        var movies = await client.GetMoviesAsync(conn);
        movies.Should().HaveCount(5);

        movies[0].Resolution.Should().Be("4K");
        movies[0].PosterUrl.Should().Be("http://img/w500/poster1.jpg");
        movies[0].AddedAt.Should().NotBeNull();

        movies[1].Resolution.Should().Be("1080p");
        movies[1].PosterUrl.Should().BeNull();
        movies[1].AddedAt.Should().BeNull();

        movies[2].Resolution.Should().Be("720p");
        movies[3].Resolution.Should().Be("SD");
        movies[4].Resolution.Should().BeNull();

        await client.DeleteMovieAsync(conn, 1, deleteFiles: true, addImportExclusion: true);
    }

    [Fact]
    public async Task PlexClient_GetSectionItemsAsync_ComprehensiveVariants()
    {
        var metaJson = @"{
            ""MediaContainer"": {
                ""Metadata"": [
                    {
                        ""ratingKey"": 100,
                        ""title"": ""Item Number Key"",
                        ""type"": ""movie"",
                        ""guid"": ""plex://movie/100"",
                        ""year"": 2021,
                        ""Guid"": [
                            { ""id"": ""imdb://tt12345"" },
                            { ""id"": """" }
                        ],
                        ""viewCount"": 5,
                        ""lastViewedAt"": 1700000000,
                        ""addedAt"": 1690000000
                    },
                    {
                        ""ratingKey"": ""200"",
                        ""title"": ""Item String Key"",
                        ""type"": ""show"",
                        ""guid"": """",
                        ""year"": 2020,
                        ""viewedLeafCount"": ""3"",
                        ""lastViewedAt"": ""1705000000"",
                        ""addedAt"": ""1695000000""
                    }
                ]
            }
        }";

        var handler = new MockHandler(req =>
        {
            if (req.RequestUri!.PathAndQuery.Contains("/library/sections/1/all"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(metaJson) };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var client = new PlexClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://plex:32400", ApiKey = "tok" };

        var items = await client.GetSectionItemsAsync(conn, "1");
        items.Should().HaveCount(2);

        items[0].RatingKey.Should().Be(100);
        items[0].Guids.Should().Contain("imdb://tt12345");
        items[0].ViewCount.Should().Be(5);
        items[0].LastViewedAt.Should().NotBeNull();
        items[0].AddedAt.Should().NotBeNull();

        items[1].RatingKey.Should().Be(200);
        items[1].ViewCount.Should().Be(3);
        items[1].LastViewedAt.Should().NotBeNull();
        items[1].AddedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SonarrClient_QualityProfileAndTierVariants()
    {
        var seriesJson = @"[
            {
                ""id"": 1,
                ""title"": ""Show 4K"",
                ""qualityProfileId"": 1,
                ""added"": ""2024-02-01T00:00:00Z"",
                ""seasons"": []
            },
            {
                ""id"": 2,
                ""title"": ""Show SD"",
                ""qualityProfileId"": 2,
                ""seasons"": []
            }
        ]";

        var handler = new MockHandler(req =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(seriesJson) }
        );

        var client = new SonarrClient(new HttpClient(handler));
        var conn4k = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "k", TierTag = "4K" };
        var connSd = new ServiceConnection { BaseUrl = "http://sonarr:8989", ApiKey = "k", TierTag = "HD" };

        var series4k = await client.GetSeriesAsync(conn4k);
        series4k[0].Resolution.Should().Be("4K");

        var seriesSd = await client.GetSeriesAsync(connSd);
        seriesSd[1].Resolution.Should().Be("SD");
    }

    [Fact]
    public async Task TautulliClient_GetHistory_ShouldParseAlternatingTypesAndEmptyBatches()
    {
        var json = @"{
            ""response"": {
                ""result"": ""success"",
                ""data"": {
                    ""recordsFiltered"": ""1"",
                    ""recordsTotal"": ""1"",
                    ""data"": [
                        {
                            ""rating_key"": 54321,
                            ""grandparent_rating_key"": 99999,
                            ""parent_rating_key"": 88888,
                            ""title"": ""Episode 1"",
                            ""grandparent_title"": ""Great Show"",
                            ""user_id"": ""user-42"",
                            ""user"": ""steve"",
                            ""parent_media_index"": 1,
                            ""date"": ""1634088068"",
                            ""media_type"": ""episode"",
                            ""year"": 2023,
                            ""guid"": ""plex://episode/54321""
                        }
                    ]
                }
            }
        }";

        var handler = new MockHandler(req =>
        {
            if (req.RequestUri!.PathAndQuery.Contains("start=0"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""response"": {""data"": {""recordsFiltered"": 1, ""data"": []}}}") };
        });

        var client = new TautulliClient(new HttpClient(handler));
        var conn = new ServiceConnection { BaseUrl = "http://tautulli:8181", ApiKey = "testkey" };

        var history = await client.GetHistoryAsync(conn);
        history.Should().HaveCount(1);
        var item = history[0];
        item.RatingKey.Should().Be(54321);
        item.GrandparentRatingKey.Should().Be("99999");
        item.ParentRatingKey.Should().Be("88888");
        item.GrandparentTitle.Should().Be("Great Show");
        item.UserId.Should().Be("user-42");
        item.SeasonNumber.Should().Be(1);
        item.Year.Should().Be(2023);
        item.Guid.Should().Be("plex://episode/54321");
    }

    [Fact]
    public async Task PlexClient_EmptyContainers_And_MissingFields_ShouldHandleGracefully()
    {
        // 1. GetSectionsAsync when MediaContainer has no Directory
        var emptySectionsJson = @"{ ""MediaContainer"": {} }";
        var client1 = new PlexClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(emptySectionsJson) }
        )));
        var conn = new ServiceConnection { BaseUrl = "http://plex:32400", ApiKey = "tok" };
        var sections = await client1.GetSectionsAsync(conn);
        sections.Should().BeEmpty();

        // 2. GetSectionItemsAsync when MediaContainer has no Metadata
        var emptyItemsJson = @"{ ""MediaContainer"": {} }";
        var client2 = new PlexClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(emptyItemsJson) }
        )));
        var items = await client2.GetSectionItemsAsync(conn, "1");
        items.Should().BeEmpty();

        // 3. GetSectionItemsAsync with edge case metadata fields (invalid ratingKey, non-string Guid, missing dates)
        var edgeJson = @"{
            ""MediaContainer"": {
                ""Metadata"": [
                    {
                        ""ratingKey"": ""not-a-number"",
                        ""title"": ""Odd Item"",
                        ""type"": ""movie"",
                        ""Guid"": [
                            { ""id"": 12345 }
                        ],
                        ""viewCount"": ""not-a-number"",
                        ""viewedLeafCount"": 4,
                        ""lastViewedAt"": ""not-a-timestamp"",
                        ""addedAt"": ""not-a-timestamp""
                    }
                ]
            }
        }";
        var client3 = new PlexClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(edgeJson) }
        )));
        var edgeItems = await client3.GetSectionItemsAsync(conn, "1");
        edgeItems.Should().HaveCount(1);
        edgeItems[0].RatingKey.Should().Be(0);
        edgeItems[0].ViewCount.Should().Be(4);
        edgeItems[0].LastViewedAt.Should().BeNull();
        edgeItems[0].AddedAt.Should().BeNull();
    }

    [Fact]
    public async Task RadarrAndSonarrClients_GetCutoffUnmet_ErrorAndMalformedJson_ShouldReturnEmpty()
    {
        var conn = new ServiceConnection { BaseUrl = "http://arr:8080", ApiKey = "k" };

        // 1. Radarr: 500 error code
        var radarrErrorClient = new RadarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
        )));
        var radarrErrors = await radarrErrorClient.GetCutoffUnmetMovieIdsAsync(conn);
        radarrErrors.Should().BeEmpty();

        // 2. Radarr: malformed / missing records
        var radarrMalformedClient = new RadarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""notRecords"": []}") }
        )));
        var radarrMalformed = await radarrMalformedClient.GetCutoffUnmetMovieIdsAsync(conn);
        radarrMalformed.Should().BeEmpty();

        // 3. Radarr: records with missing id
        var radarrInvalidIdClient = new RadarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""records"": [{""otherField"": 123}, {}]}") }
        )));
        var radarrInvalid = await radarrInvalidIdClient.GetCutoffUnmetMovieIdsAsync(conn);
        radarrInvalid.Should().BeEmpty();

        // 4. Sonarr: 500 error code
        var sonarrErrorClient = new SonarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
        )));
        var sonarrErrors = await sonarrErrorClient.GetCutoffUnmetSeriesIdsAsync(conn);
        sonarrErrors.Should().BeEmpty();

        // 5. Sonarr: malformed / missing records
        var sonarrMalformedClient = new SonarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""notRecords"": []}") }
        )));
        var sonarrMalformed = await sonarrMalformedClient.GetCutoffUnmetSeriesIdsAsync(conn);
        sonarrMalformed.Should().BeEmpty();

        // 6. Sonarr: records with missing id
        var sonarrInvalidIdClient = new SonarrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""records"": [{""otherField"": 123}, {}]}") }
        )));
        var sonarrInvalid = await sonarrInvalidIdClient.GetCutoffUnmetSeriesIdsAsync(conn);
        sonarrInvalid.Should().BeEmpty();
    }

    [Fact]
    public async Task OverseerrClient_GetRequestsAsync_MissingResultsOrMedia_ShouldHandleGracefully()
    {
        var conn = new ServiceConnection { BaseUrl = "http://overseerr:5055", ApiKey = "k" };

        // 1. Missing results array
        var client1 = new OverseerrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(@"{""other"": []}") }
        )));
        var reqs1 = await client1.GetRequestsAsync(conn);
        reqs1.Should().BeEmpty();

        // 2. Results array with item lacking media, and item with non-number tmdbId/tvdbId
        var json = @"{
            ""results"": [
                {
                    ""id"": 1,
                    ""status"": 2,
                    ""type"": ""movie""
                },
                {
                    ""id"": 2,
                    ""status"": 1,
                    ""type"": ""tv"",
                    ""media"": {
                        ""tmdbId"": ""string-id"",
                        ""tvdbId"": null
                    }
                }
            ]
        }";
        var client2 = new OverseerrClient(new HttpClient(new MockHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) }
        )));
        var reqs2 = await client2.GetRequestsAsync(conn);
        reqs2.Should().HaveCount(2);
        reqs2[0].TmdbId.Should().BeNull();
        reqs2[0].TvdbId.Should().BeNull();
        reqs2[1].TmdbId.Should().BeNull();
        reqs2[1].TvdbId.Should().BeNull();
    }
}
