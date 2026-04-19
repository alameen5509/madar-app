FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj files and restore
COPY src/Madar.API/Madar.API.csproj src/Madar.API/
COPY src/Madar.Infrastructure/Madar.Infrastructure.csproj src/Madar.Infrastructure/
COPY src/Madar.Domain/Madar.Domain.csproj src/Madar.Domain/
COPY src/Madar.Application/Madar.Application.csproj src/Madar.Application/

RUN dotnet restore src/Madar.API/Madar.API.csproj

# Copy all source and publish
COPY . .
RUN dotnet publish src/Madar.API/Madar.API.csproj -c Release -o /app --no-restore

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .

# Environment
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}

EXPOSE ${PORT:-8080}
ENTRYPOINT ["dotnet", "Madar.API.dll"]
