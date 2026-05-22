/**
 * Data Access Layer (DAL) for local tasks state.
 * Syncs seamlessly to LocalStorage, making data entirely private.
 */
const StorageEngine = {
    KEY: 'aura_operating_tasks',

    getAll() {
        const payload = localStorage.getItem(this.KEY);
        return payload ? JSON.parse(payload) : [];
    },

    saveAll(tasks) {
        localStorage.setItem(this.KEY, JSON.stringify(tasks));
    },

    save(task) {
        const current = this.getAll();
        const index = current.findIndex(t => t.id === task.id);
        if (index > -1) {
            current[index] = task;
        } else {
            current.push(task);
        }
        this.saveAll(current);
        return current;
    },

    delete(id) {
        const current = this.getAll();
        const filtered = current.filter(t => t.id !== id);
        this.saveAll(filtered);
        return filtered;
    }
};