var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Curatarr API");

app.Run();

// Make Program accessible to WebApplicationFactory in tests
public partial class Program;
