FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY services/CustomerService/CustomerService.Domain/CustomerService.Domain.csproj services/CustomerService/CustomerService.Domain/
COPY services/CustomerService/CustomerService.Application/CustomerService.Application.csproj services/CustomerService/CustomerService.Application/
COPY services/CustomerService/CustomerService.Infrastructure/CustomerService.Infrastructure.csproj services/CustomerService/CustomerService.Infrastructure/
COPY services/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj services/CustomerService/CustomerService.WebAPI/

RUN dotnet restore services/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj \
    --runtime linux-musl-x64

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM restore AS build

COPY services/CustomerService/ services/CustomerService/

RUN dotnet publish services/CustomerService/CustomerService.WebAPI/CustomerService.WebAPI.csproj \
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
