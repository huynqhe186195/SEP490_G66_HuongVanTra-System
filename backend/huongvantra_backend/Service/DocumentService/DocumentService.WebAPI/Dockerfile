FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/DocumentService/DocumentService.Domain/DocumentService.Domain.csproj Service/DocumentService/DocumentService.Domain/
COPY Service/DocumentService/DocumentService.Application/DocumentService.Application.csproj Service/DocumentService/DocumentService.Application/
COPY Service/DocumentService/DocumentService.Infrastructure/DocumentService.Infrastructure.csproj Service/DocumentService/DocumentService.Infrastructure/
COPY Service/DocumentService/DocumentService.WebAPI/DocumentService.WebAPI.csproj Service/DocumentService/DocumentService.WebAPI/

RUN dotnet restore Service/DocumentService/DocumentService.WebAPI/DocumentService.WebAPI.csproj \
    --runtime linux-musl-x64

FROM restore AS build

COPY Service/DocumentService/ Service/DocumentService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/DocumentService/DocumentService.WebAPI/DocumentService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN apk add --no-cache wget fontconfig font-liberation \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "DocumentService.WebAPI.dll"]
