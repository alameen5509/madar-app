import pg from 'pg';
import fs from 'fs';

const c = new pg.Client({
  host: 'roundhouse.proxy.rlwy.net', port: 58156,
  database: 'madar', user: 'postgres',
  password: 'v2CU5NUZHOKlR1BZeyL5V6kzRBnZno9F'
});

// All missing tables — PostgreSQL syntax
const TABLES = `
CREATE TABLE IF NOT EXISTS "UserCircles" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "CircleId" UUID, "DisplayName" VARCHAR(200), "DisplayOrder" INT DEFAULT 0, "IsActive" BOOLEAN DEFAULT TRUE, "Description" TEXT, "IconKey" VARCHAR(50), "ColorHex" VARCHAR(20), "Tier" VARCHAR(20) DEFAULT 'core', "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "CircleGroups" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Name" VARCHAR(200) NOT NULL, "DisplayOrder" INT DEFAULT 0, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "Boards" ("Id" UUID PRIMARY KEY, "OwnerId" UUID NOT NULL, "EntityType" VARCHAR(50), "EntityId" UUID, "Title" VARCHAR(300), "Data" TEXT, "CreatedAt" TIMESTAMP DEFAULT NOW(), "UpdatedAt" TIMESTAMP);
CREATE TABLE IF NOT EXISTS "DevTickets" ("Id" UUID PRIMARY KEY, "OwnerId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Description" TEXT, "Status" VARCHAR(30) DEFAULT 'open', "Priority" VARCHAR(20) DEFAULT 'medium', "AssignedTo" VARCHAR(200), "Category" VARCHAR(100), "CreatedAt" TIMESTAMP DEFAULT NOW(), "UpdatedAt" TIMESTAMP, "ClosedAt" TIMESTAMP);
CREATE TABLE IF NOT EXISTS "DevTicketHistory" ("Id" UUID PRIMARY KEY, "TicketId" UUID NOT NULL, "Action" VARCHAR(50) NOT NULL, "OldValue" TEXT, "NewValue" TEXT, "ChangedBy" UUID, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "DevContext" ("Id" UUID PRIMARY KEY, "Key" VARCHAR(100) NOT NULL, "Value" TEXT, "UpdatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "LeadershipRoles" ("Id" VARCHAR(36) PRIMARY KEY, "UserId" VARCHAR(36) NOT NULL, "Title" VARCHAR(300) NOT NULL, "Organization" VARCHAR(300), "Sector" VARCHAR(200), "Description" TEXT, "StartDate" TIMESTAMP, "WorkId" VARCHAR(36), "ReviewFrequency" VARCHAR(20) DEFAULT 'weekly', "Color" VARCHAR(20) DEFAULT '#5E5495', "Icon" VARCHAR(10) DEFAULT '🎯', "Priority" INT DEFAULT 0, "PulseStatus" VARCHAR(20) DEFAULT 'green', "PulseNote" TEXT, "LastReviewDate" TIMESTAMP, "NextReviewDate" TIMESTAMP, "IsActive" BOOLEAN DEFAULT TRUE, "SourceId" VARCHAR(36), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "LeadershipNotes" ("Id" VARCHAR(36) PRIMARY KEY, "RoleId" VARCHAR(36) NOT NULL, "UserId" VARCHAR(36) NOT NULL, "Content" TEXT, "ConvertedTaskId" VARCHAR(36), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "LeadershipDevRequests" ("Id" VARCHAR(36) PRIMARY KEY, "RoleId" VARCHAR(36) NOT NULL, "UserId" VARCHAR(36) NOT NULL, "Title" VARCHAR(500), "Description" TEXT, "Status" VARCHAR(20) DEFAULT 'new', "NextReviewDate" TIMESTAMP, "ReviewFrequency" VARCHAR(20), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "UserKV" ("UserId" VARCHAR(36) NOT NULL, "Key" VARCHAR(100) NOT NULL, "Value" TEXT, "UpdatedAt" TIMESTAMP DEFAULT NOW(), PRIMARY KEY ("UserId", "Key"));
CREATE TABLE IF NOT EXISTS "WebProjects" ("Id" UUID PRIMARY KEY, "OwnerId" UUID NOT NULL, "Title" VARCHAR(300) NOT NULL, "ClientName" VARCHAR(200), "Description" TEXT, "CurrentPhase" INT DEFAULT 1, "Status" VARCHAR(30) DEFAULT 'active', "Priority" VARCHAR(20) DEFAULT 'medium', "DueDate" VARCHAR(20), "CreatedAt" TIMESTAMP DEFAULT NOW(), "UpdatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebProjectMembers" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "UserId" UUID, "Name" VARCHAR(200) NOT NULL, "Email" VARCHAR(200), "Role" VARCHAR(30) DEFAULT 'employee', "AddedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebProjectTeams" ("Id" UUID PRIMARY KEY, "OwnerId" UUID NOT NULL, "UserId" UUID, "Name" VARCHAR(200) NOT NULL, "Email" VARCHAR(200), "Role" VARCHAR(30) DEFAULT 'employee', "AddedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebProjectKV" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Key" VARCHAR(100) NOT NULL, "Value" TEXT, "UpdatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase1Docs" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Content" TEXT, "UpdatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase1Tasks" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "AssignedTo" VARCHAR(200), "Status" VARCHAR(30) DEFAULT 'pending', "Order" INT DEFAULT 0, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase3Commands" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Command" TEXT, "Order" INT DEFAULT 0, "Status" VARCHAR(30) DEFAULT 'pending', "DoneAt" TIMESTAMP, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase4Credentials" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Type" VARCHAR(50) DEFAULT 'other', "Label" VARCHAR(200) NOT NULL, "Value" VARCHAR(1000) NOT NULL, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase5Commands" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Command" TEXT, "Order" INT DEFAULT 0, "Status" VARCHAR(30) DEFAULT 'pending', "AddedBy" UUID, "EmployeeDoneAt" TIMESTAMP, "OwnerApprovedAt" TIMESTAMP, "Notes" TEXT, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WebPhase6Requests" ("Id" UUID PRIMARY KEY, "ProjectId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Description" TEXT, "Status" VARCHAR(30) DEFAULT 'new', "ClientNote" TEXT, "OwnerNote" TEXT, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "ScreenTimeGoals" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "CurrentDailyHours" DECIMAL(4,1) DEFAULT 0, "TargetDailyHours" DECIMAL(4,1) DEFAULT 2, "WeeklyReductionMinutes" INT DEFAULT 15, "WhyMotivation" TEXT, "StartDate" TIMESTAMP DEFAULT NOW(), "TargetDate" TIMESTAMP, "Status" VARCHAR(20) DEFAULT 'active', "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "ScreenTimeLogs" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Date" DATE NOT NULL, "ActualMinutes" INT DEFAULT 0, "TargetMinutes" INT DEFAULT 0, "Mood" VARCHAR(20), "TopApps" VARCHAR(500), "Note" VARCHAR(500), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "PhoneTriggers" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "TriggerName" VARCHAR(200) NOT NULL, "Category" VARCHAR(50) DEFAULT 'boredom', "Alternative" VARCHAR(500), "Frequency" INT DEFAULT 1, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "PhoneTasks" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "RecurringType" VARCHAR(50) DEFAULT 'none', "RecurringIntervalHours" INT, "LastCompletedAt" TIMESTAMP, "NextDueAt" TIMESTAMP, "IsCompleted" BOOLEAN DEFAULT FALSE, "CompletedAt" TIMESTAMP, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "PhoneFreeZones" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "ZoneName" VARCHAR(200) NOT NULL, "StartTime" VARCHAR(10) NOT NULL, "EndTime" VARCHAR(10) NOT NULL, "DaysOfWeek" VARCHAR(50) DEFAULT 'all', "IsActive" BOOLEAN DEFAULT TRUE, "StreakDays" INT DEFAULT 0, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "BadHabits" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Name" VARCHAR(300) NOT NULL, "Category" VARCHAR(50), "Severity" INT DEFAULT 1, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "BadHabitLogs" ("Id" UUID PRIMARY KEY, "HabitId" UUID NOT NULL, "UserId" UUID NOT NULL, "OccurredAt" TIMESTAMP DEFAULT NOW(), "Trigger" VARCHAR(300), "Note" TEXT);
CREATE TABLE IF NOT EXISTS "BadHabitStrategies" ("Id" UUID PRIMARY KEY, "HabitId" UUID NOT NULL, "Strategy" TEXT NOT NULL, "IsActive" BOOLEAN DEFAULT TRUE, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "TawbahRecords" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "SinDescription" TEXT, "RepentanceDate" TIMESTAMP DEFAULT NOW(), "IsResolved" BOOLEAN DEFAULT FALSE, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "TawbahActions" ("Id" UUID PRIMARY KEY, "RecordId" UUID NOT NULL, "Action" TEXT NOT NULL, "IsCompleted" BOOLEAN DEFAULT FALSE, "CompletedAt" TIMESTAMP);
CREATE TABLE IF NOT EXISTS "TawbahReflections" ("Id" UUID PRIMARY KEY, "RecordId" UUID NOT NULL, "Content" TEXT NOT NULL, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "ReminderLogs" ("Id" UUID PRIMARY KEY, "TaskId" UUID, "UserId" UUID, "SentAt" TIMESTAMP DEFAULT NOW(), "Channel" VARCHAR(50), "Status" VARCHAR(20));
CREATE TABLE IF NOT EXISTS "HistoryRecords" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Content" TEXT, "Category" VARCHAR(100), "EventDate" VARCHAR(50), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "HistoricalEvents" ("Id" UUID PRIMARY KEY, "Title" VARCHAR(500) NOT NULL, "Description" TEXT, "HijriDate" VARCHAR(50), "GregorianDate" VARCHAR(50), "Category" VARCHAR(100), "Source" VARCHAR(300), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "HistoryFigures" ("Id" UUID PRIMARY KEY, "Name" VARCHAR(300) NOT NULL, "Title" VARCHAR(300), "Bio" TEXT, "BirthDate" VARCHAR(50), "DeathDate" VARCHAR(50), "Era" VARCHAR(100), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "Ingredients" ("Id" UUID PRIMARY KEY, "Name" VARCHAR(200) NOT NULL, "Category" VARCHAR(100), "Unit" VARCHAR(50), "CaloriesPer100g" DECIMAL(8,2) DEFAULT 0, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "IngredientPrices" ("Id" UUID PRIMARY KEY, "IngredientId" UUID NOT NULL, "Price" DECIMAL(10,2), "Store" VARCHAR(200), "RecordedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "IngredientBrands" ("Id" UUID PRIMARY KEY, "IngredientId" UUID NOT NULL, "BrandName" VARCHAR(200) NOT NULL, "Price" DECIMAL(10,2), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "Dishes" ("Id" UUID PRIMARY KEY, "Name" VARCHAR(300) NOT NULL, "Description" TEXT, "Category" VARCHAR(100), "PrepTime" INT DEFAULT 0, "CookTime" INT DEFAULT 0, "Servings" INT DEFAULT 1, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "DishIngredients" ("Id" UUID PRIMARY KEY, "DishId" UUID NOT NULL, "IngredientId" UUID NOT NULL, "Quantity" DECIMAL(10,2), "Unit" VARCHAR(50));
CREATE TABLE IF NOT EXISTS "Meals" ("Id" UUID PRIMARY KEY, "Name" VARCHAR(200) NOT NULL, "MealType" VARCHAR(50), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "MealDishes" ("Id" UUID PRIMARY KEY, "MealId" UUID NOT NULL, "DishId" UUID NOT NULL);
CREATE TABLE IF NOT EXISTS "MealPlans" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Date" DATE, "MealType" VARCHAR(50), "DishId" UUID, "DishName" VARCHAR(300), "Notes" TEXT, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "PersonalMealPlans" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Date" DATE, "MealType" VARCHAR(50), "Content" TEXT, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "ShoppingLists" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Title" VARCHAR(300), "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "ShoppingListItems" ("Id" UUID PRIMARY KEY, "ListId" UUID NOT NULL, "IngredientId" UUID, "Name" VARCHAR(300) NOT NULL, "Quantity" DECIMAL(10,2), "Unit" VARCHAR(50), "IsBought" BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS "FamilyMembers" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "Name" VARCHAR(200) NOT NULL, "Relation" VARCHAR(50), "Age" INT, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "BackupLogs" ("Id" UUID PRIMARY KEY, "UserId" UUID NOT NULL, "BackupType" VARCHAR(50), "Status" VARCHAR(20), "Size" BIGINT DEFAULT 0, "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS "WorkRequests" ("Id" UUID PRIMARY KEY, "WorkId" UUID NOT NULL, "Title" VARCHAR(500) NOT NULL, "Description" TEXT, "Status" VARCHAR(30) DEFAULT 'new', "Priority" VARCHAR(20) DEFAULT 'medium', "CreatedAt" TIMESTAMP DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS "IX_BadHabitLogs_HabitId_LogDate" ON "BadHabitLogs" ("HabitId", "LogDate");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_PersonalMealPlans_MemberId_PlanDate_MealTime" ON "PersonalMealPlans" ("MemberId", "PlanDate", "MealTime");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_MealPlans_UserId_PlanDate" ON "MealPlans" ("UserId", "PlanDate");
`;

(async () => {
  await c.connect();
  const stmts = TABLES.split(';').map(s => s.trim()).filter(s => s.length > 10);
  let created = 0;
  for (const sql of stmts) {
    try {
      await c.query(sql);
      const name = sql.match(/"(\w+)"/)?.[1];
      console.log(`  ✅ ${name}`);
      created++;
    } catch (e) {
      console.error(`  ❌ ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`\n${created} tables created`);
  await c.end();
})().catch(e => console.error(e.message));
