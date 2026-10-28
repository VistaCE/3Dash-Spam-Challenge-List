import { round, score } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = 'data';

/**
 * GitHub repo the site is deployed from, used by the time machine to read past commits
 */
const repo = 'VistaCE/3Dash-Spam-Challenge-List';
const commitsUrl = `https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`;

export async function fetchList(base = dir) {
    const listResult = await fetch(`${base}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${base}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors(base = dir) {
    try {
        const editorsResults = await fetch(`${base}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

async function fetchCommits(url) {
    const res = await fetch(url);
    if (res.status === 403 || res.status === 429) {
        throw new Error('GitHub rate limit reached. Try again in a few minutes.');
    }
    if (!res.ok) {
        throw new Error('Could not reach GitHub. Try again in a few minutes.');
    }
    return res;
}

function toSnapshot(commit) {
    return {
        sha: commit.sha,
        date: new Date(commit.commit.committer.date),
        message: commit.commit.message.split('\n')[0],
        dir: `https://raw.githubusercontent.com/${repo}/${commit.sha}/data`,
    };
}

/**
 * Last commit on main at or before `date`, or null if the list didn't exist yet
 */
export async function fetchSnapshot(date) {
    const res = await fetchCommits(`${commitsUrl}&until=${date.toISOString()}`);
    const [commit] = await res.json();
    return commit ? toSnapshot(commit) : null;
}

/**
 * Date of the first commit on main, i.e. how far back the time machine can go
 */
export async function fetchFirstSnapshotDate() {
    const res = await fetchCommits(commitsUrl);
    const last = res.headers.get('Link')?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
    const commits = last ? await (await fetchCommits(last)).json() : await res.json();
    return toSnapshot(commits[commits.length - 1]).date;
}

export async function fetchLeaderboard() {
    const list = await fetchList();

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        // Verification
        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        // Records
        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    // Wrap in extra Object containing the user and total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    // Sort by total score
    return [res.sort((a, b) => b.total - a.total), errs];
}
