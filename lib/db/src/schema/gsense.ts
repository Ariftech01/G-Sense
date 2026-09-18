import { pgTable, serial, text, boolean, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accessibilityPreferences = pgTable("accessibility_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  visionMode: text("vision_mode"),
  avoidStairs: boolean("avoid_stairs").default(true),
  preferElevator: boolean("prefer_elevator").default(true),
  avoidCrowds: boolean("avoid_crowds").default(true),
  responseStyle: text("response_style"),
  language: text("language"),
  payload: jsonb("payload"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const environmentalObservations = pgTable("environmental_observations", {
  id: serial("id").primaryKey(),
  locationLabel: text("location_label"),
  payload: jsonb("payload").notNull(),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const environmentStates = pgTable("environment_states", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id"),
  pathStatus: text("path_status"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const environmentChanges = pgTable("environment_changes", {
  id: serial("id").primaryKey(),
  changeType: text("change_type"),
  impact: text("impact"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const navigationSessions = pgTable("navigation_sessions", {
  id: serial("id").primaryKey(),
  goal: text("goal"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campusKnowledge = pgTable("campus_knowledge", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  payload: jsonb("payload").notNull(),
});

export const aiPredictions = pgTable("ai_predictions", {
  id: serial("id").primaryKey(),
  model: text("model"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
