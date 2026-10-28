import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import TimeMachine from './pages/TimeMachine.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/time-machine', component: TimeMachine },
];
