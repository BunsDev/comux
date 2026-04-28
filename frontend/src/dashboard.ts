import { createApp } from 'vue';
import Dashboard from './components/Dashboard.vue';
import './styles.css';
import './dashboard.css';

const app = createApp(Dashboard);
app.mount('#app');
