FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/Madar.API/Madar.API.csproj", "src/Madar.API/"]
COPY ["src/Madar.Application/Madar.Application.csproj", "src/Madar.Application/"]
COPY ["src/Madar.Domain/Madar.Domain.csproj", "src/Madar.Domain/"]
COPY ["src/Madar.Infrastructure/Madar.Infrastructure.csproj", "src/Madar.Infrastructure/"]
RUN dotnet restore "src/Madar.API/Madar.API.csproj"
COPY . .
WORKDIR "/src/src/Madar.API"
RUN dotnet build "Madar.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Madar.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Madar.API.dll"]
