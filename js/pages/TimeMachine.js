import { store } from '../main.js';
import { fetchSnapshot, fetchFirstSnapshotDate } from '../content.js';

import List from './List.js';
import Spinner from '../components/Spinner.js';

// Format a Date the way <input type="datetime-local"> expects, in local time
function toInputValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default {
    components: { List, Spinner },
    template: `
        <div class="page-time-machine">
            <form class="time-machine__bar" @submit.prevent="travel">
                <label class="type-label-lg" for="time-machine-date">See the list as it was on</label>
                <input id="time-machine-date" class="type-label-lg" type="datetime-local" v-model="input" :min="min" :max="max" required>
                <button class="btn" type="submit" :disabled="loading">
                    <span class="type-label-lg">Travel</span>
                </button>
                <router-link v-if="snapshot" class="type-label-lg time-machine__back" to="/">Back to present</router-link>
            </form>
            <p v-if="error" class="time-machine__info time-machine__error">{{ error }}</p>
            <p v-else-if="snapshot" class="time-machine__info type-label-md">
                Showing the list from {{ format(snapshot.date) }} &middot; "{{ snapshot.message }}"
            </p>
            <p v-else-if="earliest" class="time-machine__info type-label-md">
                History goes back to {{ format(earliest) }}.
            </p>
            <main v-if="loading" :class="{ dark: store.dark }">
                <Spinner></Spinner>
            </main>
            <List v-else-if="snapshot" :key="snapshot.sha" :data-dir="snapshot.dir" :class="{ dark: store.dark }"></List>
        </div>
    `,
    data: () => ({
        input: '',
        min: undefined,
        max: toInputValue(new Date()),
        earliest: null,
        snapshot: null,
        loading: false,
        error: null,
        store,
    }),
    watch: {
        // The chosen time lives in the URL (?at=...) so it can be shared and the back button works
        '$route.query.at': {
            immediate: true,
            handler(at) {
                this.load(at);
            },
        },
    },
    async mounted() {
        try {
            this.earliest = await fetchFirstSnapshotDate();
            this.min = toInputValue(this.earliest);
        } catch {
            // Only used as a hint, so travelling still works without it
        }
    },
    methods: {
        travel() {
            this.$router.push({ path: '/time-machine', query: { at: this.input } });
        },
        async load(at) {
            this.error = null;
            this.snapshot = null;
            if (!at) return;

            const date = new Date(at);
            if (isNaN(date)) {
                this.error = 'That date is not valid.';
                return;
            }

            this.input = at;
            this.loading = true;
            try {
                this.snapshot = await fetchSnapshot(date);
                if (!this.snapshot) {
                    this.error = 'The list did not exist yet at that time.';
                }
            } catch (e) {
                this.error = e.message;
            }
            this.loading = false;
        },
        format(date) {
            return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        },
    },
};
