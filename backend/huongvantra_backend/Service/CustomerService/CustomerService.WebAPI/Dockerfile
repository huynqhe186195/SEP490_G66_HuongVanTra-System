FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Service/CustomerService/CustomerService.Domain/CustomerService.Domain.csproj Service/CustomerService/CustomerService.Domain/
COPY Service/CustomerService/CustomerService.Application/CustomerService.Application.csproj Service/CustomerService/CustomerService.Application/
COPY Service/CustomerService/CustomerService.Infrastructure/CustomerService.Infrastructure.csproj Service/CustomerService/CustomerService.Infrastructure/
COPY Service/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj Service/CustomerService/CustomerService.WebAPI/

RUN dotnet restore Service/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj \
    --runtime linux-musl-x64

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM restore AS build

COPY Service/CustomerService/ Service/CustomerService/

RUN dotnet publish Service/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

# ── Stage 3: final (runtime only — no SDK) ────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "CustomerService.WebAPI.dll"]
