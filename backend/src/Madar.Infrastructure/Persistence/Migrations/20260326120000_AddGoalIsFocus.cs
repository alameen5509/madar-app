using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Madar.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalIsFocus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FocusType",
                table: "Goals",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FocusType",
                table: "Goals");
        }
    }
}
