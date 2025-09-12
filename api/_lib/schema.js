// Whitelist of tables and allowed columns for generic CRUD endpoints.
// Add your tables and columns here to enable them.
export const schema = {
  tasks: {
    columns: ["id", "name", "completed", "created_at"],
    primaryKey: "id",
    insertable: ["name", "completed"],
    updatable: ["name", "completed"],
  },
  // Example:
  // projects: {
  //   columns: ["id", "title", "created_at"],
  //   primaryKey: "id",
  //   insertable: ["title"],
  //   updatable: ["title"],
  // },
};
