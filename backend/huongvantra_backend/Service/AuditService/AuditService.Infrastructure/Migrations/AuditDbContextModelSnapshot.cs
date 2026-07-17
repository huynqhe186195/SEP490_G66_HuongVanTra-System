using System;
using AuditService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace AuditService.Infrastructure.Migrations
{
    [DbContext(typeof(AuditDbContext))]
    partial class AuditDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.0")
                .HasAnnotation("Relational:MaxIdentifierLength", 64);

            modelBuilder.Entity("AuditService.Domain.Entities.SystemActivityLog", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("char(36)")
                        .HasCollation("ascii_general_ci");

                    b.Property<string>("Action")
                        .IsRequired()
                        .HasMaxLength(255)
                        .HasColumnType("varchar(255)");

                    b.Property<Guid?>("ActorId")
                        .HasColumnType("char(36)")
                        .HasCollation("ascii_general_ci");

                    b.Property<string>("ActorName")
                        .HasMaxLength(255)
                        .HasColumnType("varchar(255)");

                    b.Property<string>("ActorRole")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("AfterSnapshotJson")
                        .HasColumnType("LONGTEXT");

                    b.Property<string>("BeforeSnapshotJson")
                        .HasColumnType("LONGTEXT");

                    b.Property<string>("ClientIp")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("CorrelationId")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Description")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<string>("EntityCode")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("EntityId")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("EntityType")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<Guid>("EventId")
                        .HasColumnType("char(36)")
                        .HasCollation("ascii_general_ci");

                    b.Property<string>("HttpMethod")
                        .IsRequired()
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<string>("Module")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<DateTime>("OccurredAtUtc")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Reason")
                        .HasMaxLength(2000)
                        .HasColumnType("varchar(2000)");

                    b.Property<string>("RequestPath")
                        .IsRequired()
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("Result")
                        .IsRequired()
                        .HasMaxLength(30)
                        .HasColumnType("varchar(30)");

                    b.Property<string>("ServiceName")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<int>("StatusCode")
                        .HasColumnType("int");

                    b.Property<string>("UserAgent")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.HasKey("Id");

                    b.HasIndex("Action");
                    b.HasIndex("ActorId");
                    b.HasIndex("ActorName");
                    b.HasIndex("ActorRole");
                    b.HasIndex("CorrelationId");
                    b.HasIndex("EntityCode");
                    b.HasIndex("EventId").IsUnique();
                    b.HasIndex("Module");
                    b.HasIndex("OccurredAtUtc");
                    b.HasIndex("Result");
                    b.HasIndex("ServiceName");

                    b.ToTable("SystemActivityLogs");
                });
#pragma warning restore 612, 618
        }
    }
}
