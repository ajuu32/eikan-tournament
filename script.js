
const STORAGE_KEY = "eikanTournamentData";

let data = {
    teams: [],
    matches: []
};

// HTMLに安全に文字を表示する
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// 古い保存データにも対応する
function normalizeHomeRuns(homeRuns) {
    if (!Array.isArray(homeRuns)) return [];

    return homeRuns.map(item => {
        if (typeof item === "string") {
            return {
                name: item,
                owner: "",
                count: 1
            };
        }

        if (item && typeof item.name === "string") {
            const count = Number(item.count);

            return {
                name: item.name,
                owner: typeof item.owner === "string" ? item.owner : "",
                count: Number.isInteger(count) && count > 0 ? count : 1
            };
        }

        return null;
    }).filter(item => item && item.name.trim() !== "");
}

// 保存データの読み込み
function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (
                Array.isArray(parsed.teams) &&
                Array.isArray(parsed.matches)
            ) {
                data = parsed;

                data.matches.forEach(match => {
                    match.homeRuns = normalizeHomeRuns(match.homeRuns);
                });
            }
        }
    } catch (error) {
        console.error("データを読み込めませんでした。", error);
    }
}

// データの保存
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ホームラン入力欄を1行追加
function addHomeRunRow(name = "", count = 1, owner = "") {
    const area = document.getElementById("homeRunInputs");
    const row = document.createElement("div");

    row.className = "home-run-row";

    row.style.display = "grid";
    row.style.gridTemplateColumns = "1.2fr 1fr 100px auto";
    row.style.gap = "8px";
    row.style.alignItems = "end";

    const ownerOptions = data.teams.map(person => `
        <option
            value="${escapeHTML(person)}"
            ${owner === person ? "selected" : ""}
        >
            ${escapeHTML(person)}
        </option>
    `).join("");

    row.innerHTML = `
        <div>
            <label>選手名</label>
            <input
                type="text"
                class="home-run-name"
                placeholder="ここに選手名をいれてね"
                value="${escapeHTML(name)}"
            >
        </div>

        <div>
            <label>所属プレイヤー</label>
            <select class="home-run-owner">
                <option value="">選択してください</option>
                ${ownerOptions}
            </select>
        </div>

        <div>
            <label>本数</label>
            <input
                type="number"
                class="home-run-count"
                min="1"
                step="1"
                value="${count}"
            >
        </div>

        <button
            type="button"
            class="remove-home-run-button"
        >
            削除
        </button>
    `;

    row.querySelector(".remove-home-run-button")
        .addEventListener("click", () => {
            row.remove();
        });

    area.appendChild(row);
}

// ホームラン入力欄の所属プレイヤーを更新
function updateHomeRunOwnerOptions() {
    document.querySelectorAll(".home-run-row").forEach(row => {
        const select = row.querySelector(".home-run-owner");
        const previousValue = select.value;

        select.innerHTML = `
            <option value="">選択してください</option>
            ${data.teams.map(person => `
                <option value="${escapeHTML(person)}">
                    ${escapeHTML(person)}
                </option>
            `).join("")}
        `;

        if (data.teams.includes(previousValue)) {
            select.value = previousValue;
        }
    });
}

// ホームラン入力欄を初期状態に戻す
function resetHomeRunInputs() {
    document.getElementById("homeRunInputs").innerHTML = "";
    addHomeRunRow();
}

// 参加者設定画面
function renderTeamSettings() {
    const area = document.getElementById("teamSettings");
    const currentCount = data.teams.length || 5;

    area.innerHTML = `
        <label for="teamCount">参加人数</label>

        <select id="teamCount">
            ${[2, 3, 4, 5, 6].map(n => `
                <option
                    value="${n}"
                    ${currentCount === n ? "selected" : ""}
                >
                    ${n}人
                </option>
            `).join("")}
        </select>

        <div id="participantInputs"></div>

        <button id="saveTeams" class="save-button">
            参加者設定を保存
        </button>

        <p>
            ※参加者設定を変更すると、登録済みの試合結果はリセットされます。
        </p>
    `;

    const countSelect = document.getElementById("teamCount");

    function renderNameInputs() {
        const count = Number(countSelect.value);
        const namesArea = document.getElementById("participantInputs");

        namesArea.innerHTML = Array.from({ length: count }, (_, i) => `
            <label for="participant${i}">
                参加者${i + 1}の名前
            </label>

            <input
                id="participant${i}"
                value="${escapeHTML(data.teams[i] || "")}"
                placeholder="参加者${i + 1}"
            >
        `).join("");
    }

    countSelect.addEventListener("change", renderNameInputs);
    renderNameInputs();

    document.getElementById("saveTeams").addEventListener("click", () => {
        const count = Number(countSelect.value);
        const names = [];

        for (let i = 0; i < count; i++) {
            const value = document
                .getElementById(`participant${i}`)
                .value.trim();

            names.push(value || `参加者${i + 1}`);
        }

        if (new Set(names).size !== names.length) {
            alert("参加者名が重複しています。別々の名前にしてください。");
            return;
        }

        const changed =
            JSON.stringify(names) !== JSON.stringify(data.teams);

        if (changed && data.matches.length > 0) {
            const confirmed = confirm(
                "参加者設定を変更すると、登録済みの試合結果がすべて消えます。よろしいですか？"
            );

            if (!confirmed) return;
        }

        data.teams = names;

        if (changed) {
            data.matches = [];
        }

        saveData();
        renderAll();
        updateHomeRunOwnerOptions();

        alert("参加者設定を保存しました！");
    });
}

// 総当たり戦の順位計算
function getLeagueStandings() {
    const stats = data.teams.map((name, index) => ({
        name,
        index,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        runsFor: 0,
        runsAgainst: 0,
        diff: 0,
        headToHeadWins: 0
    }));

    const leagueMatches = data.matches.filter(
        match => match.type === "league"
    );

    leagueMatches.forEach(match => {
        const a = stats[match.a];
        const b = stats[match.b];

        if (!a || !b) return;

        a.played++;
        b.played++;

        a.runsFor += match.scoreA;
        a.runsAgainst += match.scoreB;

        b.runsFor += match.scoreB;
        b.runsAgainst += match.scoreA;

        if (match.scoreA > match.scoreB) {
            a.wins++;
            b.losses++;
        } else if (match.scoreA < match.scoreB) {
            b.wins++;
            a.losses++;
        } else {
            a.draws++;
            b.draws++;
        }
    });

    stats.forEach(person => {
        person.diff = person.runsFor - person.runsAgainst;
    });

    // 同じ勝利数の参加者同士の直接対決
    const groups = {};

    stats.forEach(person => {
        if (!groups[person.wins]) {
            groups[person.wins] = [];
        }

        groups[person.wins].push(person.index);
    });

    Object.values(groups).forEach(indices => {
        if (indices.length < 2) return;

        leagueMatches.forEach(match => {
            if (
                !indices.includes(match.a) ||
                !indices.includes(match.b)
            ) return;

            if (match.scoreA > match.scoreB) {
                stats[match.a].headToHeadWins++;
            } else if (match.scoreB > match.scoreA) {
                stats[match.b].headToHeadWins++;
            }
        });
    });

    stats.sort((a, b) =>
        b.wins - a.wins ||
        b.headToHeadWins - a.headToHeadWins ||
        b.diff - a.diff ||
        b.runsFor - a.runsFor ||
        a.index - b.index
    );

    return stats;
}

// 総当たり戦の必要試合数
function getExpectedMatches() {
    const count = data.teams.length;
    return count * (count - 1) / 2;
}

// 総当たり戦が終了しているか
function isLeagueComplete() {
    if (data.teams.length < 2) return false;

    const expected = getExpectedMatches();

    const actual = data.matches.filter(
        match => match.type === "league"
    ).length;

    return actual === expected;
}

// 決勝・最下位決定戦の対戦相手
function getPlayoffTeams() {
    if (!isLeagueComplete()) return null;

    const standings = getLeagueStandings();

    return {
        final: [
            standings[0].index,
            standings[1].index
        ],

        last: standings.length >= 4
            ? [
                standings[standings.length - 2].index,
                standings[standings.length - 1].index
            ]
            : null
    };
}

// 試合入力欄の参加者を更新
function updateTeamOptions() {
    const type = document.getElementById("matchType").value;
    const selectA = document.getElementById("teamA");
    const selectB = document.getElementById("teamB");

    let available = data.teams.map((name, index) => ({
        name,
        index
    }));

    if (type !== "league") {
        const playoff = getPlayoffTeams();

        if (!playoff) {
            available = [];
        } else {
            const pair = type === "final"
                ? playoff.final
                : playoff.last;

            available = pair
                ? pair.map(index => ({
                    name: data.teams[index],
                    index
                }))
                : [];
        }
    }

    if (available.length === 0) {
        selectA.innerHTML = `<option value="">対戦相手未決定</option>`;
        selectB.innerHTML = `<option value="">対戦相手未決定</option>`;
        updateScoreLabels();
        return;
    }

    const options = available.map(person => `
        <option value="${person.index}">
            ${escapeHTML(person.name)}
        </option>
    `).join("");

    selectA.innerHTML = options;
    selectB.innerHTML = options;

    if (available.length >= 2) {
        selectB.selectedIndex = 1;
    }

    updateScoreLabels();
}

// 選択中の対戦者名に合わせて得点欄の表示を変更
function updateScoreLabels() {
    const selectA = document.getElementById("teamA");
    const selectB = document.getElementById("teamB");
    const labelA = document.getElementById("scoreALabel");
    const labelB = document.getElementById("scoreBLabel");

    const indexA = selectA.value;
    const indexB = selectB.value;

    const nameA = indexA !== "" && data.teams[Number(indexA)]
        ? data.teams[Number(indexA)]
        : "参加者①";

    const nameB = indexB !== "" && data.teams[Number(indexB)]
        ? data.teams[Number(indexB)]
        : "参加者②";

    labelA.textContent = `${nameA}の得点`;
    labelB.textContent = `${nameB}の得点`;
}

// 入力されたホームラン記録を取得
function collectHomeRuns() {
    const rows = document.querySelectorAll(".home-run-row");
    const homeRuns = [];

    for (const row of rows) {
        const name = row.querySelector(".home-run-name").value.trim();
        const owner = row.querySelector(".home-run-owner").value;
        const countInput = row.querySelector(".home-run-count").value;
        const count = Number(countInput);

        // 空欄の行は無視
        if (
            name === "" &&
            owner === "" &&
            (countInput === "" || countInput === "1")
        ) continue;

        if (name === "") {
            alert("ホームランを打った選手の名前を入力してください。");
            return null;
        }

        if (owner === "") {
            alert(`${name}選手の所属プレイヤーを選択してください。`);
            return null;
        }

        if (
            countInput === "" ||
            !Number.isInteger(count) ||
            count < 1
        ) {
            alert(
                `${name}選手のホームラン本数を1以上の整数で入力してください。`
            );
            return null;
        }

        // 同じ選手名・同じ所属プレイヤーなら合算
        const existing = homeRuns.find(item =>
            item.name === name && item.owner === owner
        );

        if (existing) {
            existing.count += count;
        } else {
            homeRuns.push({
                name,
                owner,
                count
            });
        }
    }

    return homeRuns;
}

// 試合結果の登録
function saveMatch() {
    if (data.teams.length < 2) {
        alert("先に参加者設定を保存してください。");
        return;
    }

    const type = document.getElementById("matchType").value;
    const a = Number(document.getElementById("teamA").value);
    const b = Number(document.getElementById("teamB").value);

    const scoreAInput = document.getElementById("scoreA").value;
    const scoreBInput = document.getElementById("scoreB").value;

    const scoreA = Number(scoreAInput);
    const scoreB = Number(scoreBInput);
    const cold = document.getElementById("cold").value;

    const homeRuns = collectHomeRuns();

    if (homeRuns === null) return;

    if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a === b ||
        !data.teams[a] ||
        !data.teams[b]
    ) {
        alert("対戦者を正しく選んでください。");
        return;
    }

    if (
        scoreAInput === "" ||
        scoreBInput === "" ||
        !Number.isInteger(scoreA) ||
        !Number.isInteger(scoreB) ||
        scoreA < 0 ||
        scoreB < 0
    ) {
        alert("両者の得点を0以上の整数で入力してください。");
        return;
    }

    if (type !== "league" && scoreA === scoreB) {
        alert("決勝・最下位決定戦は引き分けにできません。");
        return;
    }

    if (type !== "league") {
        const playoff = getPlayoffTeams();

        const expected = playoff &&
            (type === "final" ? playoff.final : playoff.last);

        if (!expected || !expected.includes(a) || !expected.includes(b)) {
            alert("現在の順位決定戦の対戦相手と一致していません。");
            return;
        }
    }

    // 同じ対戦は再登録すると上書き
    const existingIndex = data.matches.findIndex(match =>
        match.type === type &&
        (
            (match.a === a && match.b === b) ||
            (match.a === b && match.b === a)
        )
    );

    const match = {
        type,
        a,
        b,
        scoreA,
        scoreB,
        cold,
        homeRuns,
        date: new Date().toLocaleString("ja-JP")
    };

    if (existingIndex >= 0) {
        data.matches[existingIndex] = match;
    } else {
        data.matches.push(match);
    }

    saveData();

    document.getElementById("scoreA").value = "";
    document.getElementById("scoreB").value = "";
    document.getElementById("cold").value = "";

    resetHomeRunInputs();

    renderAll();

    alert("試合結果を登録しました！");
}

// ホームラン記録を表示
function getHomeRunDisplay(match) {
    const records = normalizeHomeRuns(match.homeRuns);

    if (records.length === 0) return "なし";

    return records.map(item =>
        `${escapeHTML(item.name)}（${escapeHTML(item.owner || "未設定")}） ${item.count}本`
    ).join("、");
}

// 全試合のホームラン数を集計
function getHomeRunRanking() {
    const totals = new Map();

    data.matches.forEach(match => {
        normalizeHomeRuns(match.homeRuns).forEach(item => {
            const owner = item.owner || "未設定";
            const key = JSON.stringify([item.name, owner]);

            if (!totals.has(key)) {
                totals.set(key, {
                    name: item.name,
                    owner,
                    count: 0
                });
            }

            totals.get(key).count += item.count;
        });
    });

    return [...totals.values()].sort((a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name, "ja") ||
        a.owner.localeCompare(b.owner, "ja")
    );
}

// ホームラン王の表示
function getHomeRunKingHTML() {
    const ranking = getHomeRunRanking();

    if (ranking.length === 0) {
        return `
            <h3>ホームラン王</h3>
            <p>ホームラン記録はまだありません。</p>
        `;
    }

    const highestCount = ranking[0].count;

    const kings = ranking.filter(
        person => person.count === highestCount
    );

    return `
        <h3>ホームラン王</h3>

        <ol>
            ${kings.map(person => `
                <li>
                    ${escapeHTML(person.name)}
                    （${escapeHTML(person.owner)}）：
                    <strong>${person.count}本</strong>
                </li>
            `).join("")}
        </ol>
    `;
}

// 試合履歴の表示
function formatMatch(match) {
    const typeNames = {
        league: "総当たり戦",
        final: "決勝",
        last: "最下位決定戦"
    };

    const coldText = match.cold
        ? `${escapeHTML(match.cold)}回コールド`
        : "コールドなし";

    const homeRunText = getHomeRunDisplay(match);

    return `
        <div class="match-record">
            <strong>${typeNames[match.type]}</strong><br>

            ${escapeHTML(data.teams[match.a])}
            <strong>${match.scoreA}－${match.scoreB}</strong>
            ${escapeHTML(data.teams[match.b])}

            <br>

            <small>
                ${coldText} ／ HR：${homeRunText}
            </small>

            <br>

            <small>${escapeHTML(match.date || "")}</small>
        </div>
    `;
}

function renderMatchHistory() {
    const area = document.getElementById("matchHistory");

    if (data.matches.length === 0) {
        area.innerHTML = "<p>まだ試合結果がありません。</p>";
        return;
    }

    area.innerHTML = [...data.matches]
        .reverse()
        .map(formatMatch)
        .join("");
}

// 大会結果の表示
function renderResults() {
    const standings = getLeagueStandings();

    if (data.teams.length < 2) {
        document.getElementById("standings").innerHTML =
            "<p>まずは試合入力画面で参加者を登録してください。</p>";

        document.getElementById("championship").textContent =
            "参加者登録後に表示されます。";

        document.getElementById("lastPlace").textContent =
            "参加者登録後に表示されます。";

        document.getElementById("finalStandings").textContent =
            "参加者登録後に表示されます。";

        return;
    }

    // 総当たり戦順位表
    document.getElementById("standings").innerHTML = `
        <table>
            <tr>
                <th>順位</th>
                <th>参加者名</th>
                <th>試合</th>
                <th>勝</th>
                <th>敗</th>
                <th>分</th>
                <th>得失点差</th>
            </tr>

            ${standings.map((person, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHTML(person.name)}</td>
                    <td>${person.played}</td>
                    <td>${person.wins}</td>
                    <td>${person.losses}</td>
                    <td>${person.draws}</td>
                    <td>${person.diff > 0 ? "+" : ""}${person.diff}</td>
                </tr>
            `).join("")}
        </table>

        <p>
            順位は勝利数、同勝利数の参加者間の直接対決勝利数、
            得失点差、総得点の順で決まります。
        </p>

        <p>
            総当たり戦：
            ${data.matches.filter(m => m.type === "league").length}
            / ${getExpectedMatches()} 試合
        </p>
    `;

    const playoff = getPlayoffTeams();

    if (!playoff) {
        document.getElementById("championship").textContent =
            "総当たり戦が終了すると、1位と2位が決勝に進みます。";

        document.getElementById("lastPlace").textContent =
            data.teams.length >= 4
                ? "総当たり戦終了後、下位2人で最下位決定戦を行います。"
                : "4人以上の場合に最下位決定戦を行います。";

        document.getElementById("finalStandings").textContent =
            "順位決定戦終了後に表示されます。";

        return;
    }

    const finalMatch = data.matches.find(m => m.type === "final");
    const lastMatch = data.matches.find(m => m.type === "last");

    // 決勝
    document.getElementById("championship").innerHTML = `
        <p>
            ${escapeHTML(data.teams[playoff.final[0]])}
            vs
            ${escapeHTML(data.teams[playoff.final[1]])}
        </p>

        ${finalMatch
            ? `<strong>
                結果：
                ${escapeHTML(data.teams[finalMatch.a])}
                ${finalMatch.scoreA}－${finalMatch.scoreB}
                ${escapeHTML(data.teams[finalMatch.b])}
            </strong>`
            : "<p>決勝の結果はまだ登録されていません。</p>"
        }
    `;

    // 最下位決定戦
    if (playoff.last) {
        document.getElementById("lastPlace").innerHTML = `
            <p>
                ${escapeHTML(data.teams[playoff.last[0]])}
                vs
                ${escapeHTML(data.teams[playoff.last[1]])}
            </p>

            ${lastMatch
                ? `<strong>
                    結果：
                    ${escapeHTML(data.teams[lastMatch.a])}
                    ${lastMatch.scoreA}－${lastMatch.scoreB}
                    ${escapeHTML(data.teams[lastMatch.b])}
                </strong>`
                : "<p>最下位決定戦の結果はまだ登録されていません。</p>"
            }
        `;
    } else {
        document.getElementById("lastPlace").textContent =
            "4人未満のため、最下位決定戦はありません。";
    }

    // 最終順位の作成
    const finalOrder = [];

    if (finalMatch) {
        const winner = finalMatch.scoreA > finalMatch.scoreB
            ? finalMatch.a
            : finalMatch.b;

        const loser = winner === finalMatch.a
            ? finalMatch.b
            : finalMatch.a;

        finalOrder.push(winner, loser);
    }

    // 3位など、中間順位の参加者
    const middleTeams = standings
        .slice(2, playoff.last ? -2 : undefined)
        .map(person => person.index);

    finalOrder.push(...middleTeams);

    if (playoff.last && lastMatch) {
        const winner = lastMatch.scoreA > lastMatch.scoreB
            ? lastMatch.a
            : lastMatch.b;

        const loser = winner === lastMatch.a
            ? lastMatch.b
            : lastMatch.a;

        finalOrder.push(winner, loser);
    } else if (playoff.last) {
        finalOrder.push(...playoff.last);
    }

    if (!finalMatch || (playoff.last && !lastMatch)) {
        document.getElementById("finalStandings").textContent =
            "決勝・最下位決定戦の結果を登録すると、最終順位が表示されます。";
    } else {
        document.getElementById("finalStandings").innerHTML = `
            <ol>
                ${finalOrder.map(index => `
                    <li>${escapeHTML(data.teams[index])}</li>
                `).join("")}
            </ol>

            <div class="home-run-champion">
                ${getHomeRunKingHTML()}
            </div>
        `;
    }
}

// すべての画面を更新
function renderAll() {
    renderTeamSettings();
    updateTeamOptions();
    renderResults();
    renderMatchHistory();
}

// タブ切り替え
function setupTabs() {
    const resultTab = document.getElementById("resultTab");
    const inputTab = document.getElementById("inputTab");

    const resultScreen = document.getElementById("resultScreen");
    const inputScreen = document.getElementById("inputScreen");

    resultTab.addEventListener("click", () => {
        resultTab.classList.add("active");
        inputTab.classList.remove("active");

        resultScreen.classList.add("active");
        inputScreen.classList.remove("active");
    });

    inputTab.addEventListener("click", () => {
        inputTab.classList.add("active");
        resultTab.classList.remove("active");

        inputScreen.classList.add("active");
        resultScreen.classList.remove("active");
    });
}

// 起動処理
loadData();
setupTabs();

document.getElementById("matchType").addEventListener(
    "change",
    updateTeamOptions
);

// 対戦者の選択が変わったら得点欄の名前も変更
document.getElementById("teamA").addEventListener(
    "change",
    updateScoreLabels
);

document.getElementById("teamB").addEventListener(
    "change",
    updateScoreLabels
);

document.getElementById("addHomeRun").addEventListener(
    "click",
    () => addHomeRunRow()
);

document.getElementById("saveMatch").addEventListener(
    "click",
    saveMatch
);

resetHomeRunInputs();
renderAll();
