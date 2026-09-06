# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY src/Curatarr.Web/package*.json ./
RUN npm ci
COPY src/Curatarr.Web/ ./
RUN npm run build

# Stage 2: Build & Publish .NET Backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-builder
WORKDIR /app/backend
COPY curatarr.slnx Directory.Build.props ./
COPY src/Curatarr.Core/ src/Curatarr.Core/
COPY src/Curatarr.Infrastructure/ src/Curatarr.Infrastructure/
COPY src/Curatarr.Api/ src/Curatarr.Api/
RUN dotnet restore curatarr.slnx
RUN dotnet publish src/Curatarr.Api/Curatarr.Api.csproj -c Release -o /app/publish

# Copy built frontend into published wwwroot
COPY --from=frontend-builder /app/Curatarr.Api/wwwroot /app/publish/wwwroot

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    CURATARR__DATA_DIR=/app/data \
    DOTNET_RUNNING_IN_CONTAINER=true

RUN mkdir -p /app/data && chown -R 1000:1000 /app

COPY --from=backend-builder --chown=1000:1000 /app/publish .

USER 1000:1000
EXPOSE 8080

ENTRYPOINT ["dotnet", "Curatarr.Api.dll"]
