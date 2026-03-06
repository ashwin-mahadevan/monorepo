import {
  bigint,
  foreignKey,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const common = {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),

  created: timestamp("created").notNull().defaultNow(),
  updated: timestamp("updated").notNull().defaultNow(),
};

export const addressType = pgEnum("address_type", ["human", "agent"]);

export const address = pgTable(
  "address",
  {
    ...common,
    type: addressType("type").notNull(),
    display: text("display").notNull(),
    local: text("local").notNull(),
    domain: text("domain").notNull(),
  },
  (table) => [
    uniqueIndex("address_local_domain_unique").on(table.local, table.domain),
  ],
);

export const message = pgTable(
  "message",
  {
    ...common,

    parent: bigint("parent", { mode: "bigint" }),

    sender: bigint("sender", { mode: "bigint" })
      .notNull()
      .references(() => address.id),

    content: text("content").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parent],
      foreignColumns: [table.id],
    }),
  ],
);

export const delivery = pgTable("delivery", {
  ...common,

  message: bigint("message", { mode: "bigint" })
    .notNull()
    .references(() => message.id),

  receiver: bigint("address", { mode: "bigint" })
    .notNull()
    .references(() => address.id),
});

export const completion = pgTable("completion", {
  ...common,
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
});
