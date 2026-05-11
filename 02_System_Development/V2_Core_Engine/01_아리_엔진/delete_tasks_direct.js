import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  // We need to delete from TaskComment and Task where project_id matches and id >= 1777811330667892
  db.run(`DELETE FROM TaskComment WHERE task_id IN (SELECT id FROM Task WHERE project_id = 'proj-1777862333403' AND id >= 1777811330667892)`, function(err) {
    if (err) console.error("Error deleting comments", err);
    else console.log(`Deleted ${this.changes} comments`);
    
    db.run(`DELETE FROM Task WHERE project_id = 'proj-1777862333403' AND id >= 1777811330667892`, function(err) {
      if (err) console.error("Error deleting tasks", err);
      else console.log(`Deleted ${this.changes} tasks`);
      
      process.exit(0);
    });
  });
});
