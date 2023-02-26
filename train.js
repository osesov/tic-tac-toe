import fs from 'fs';
import synaptic from 'synaptic';
import ai from './ai.js';
import util from './util.js';

const { Trainer } = synaptic;

const { network, trainer } = ai.create_network(synaptic);
console.log(network.layers.input.size, ' => ', network.layers.output.size);

const E = 0;
const O = -1;
const X = +1;

const DRAW = 0.5;
const WIN  = 1.0;
const LOST = 0.0;

function invertScore(score)
{
    return 1 - score;
}

function board(arr)
{
    return JSON.stringify(arr.map( x=> Number(x.toFixed(3))));
}

function bestMove(arr)
{
    return arr.reduce( (oldIndex, currentValue, currentIndex, array) => {
        const oldValue = array[oldIndex];
        return currentValue > oldValue ? currentIndex : oldIndex
    }, 0)
}

function otherPlayer(player)
{
    return -player;
}

function checkGameStatus(state, options)
{
    options = options || {}

    const check = (p0, p1, p2) =>
    {
        const v0 = state[p0];
        const v1 = state[p1];
        const v2 = state[p2];

        return v0 !== E && v0 === v1 && v0 === v2 ? [v0] : false
    }

    const win = false
        || check(0, 1, 2)
        || check(3, 4, 5)
        || check(6, 7, 8)
        || check(0, 4, 8)
        || check(2, 4, 6)
        || check(0, 3, 6)
        || check(1, 4, 7)
        || check(2, 5, 8)

    const complete = win || state.reduce((acc, value) => acc && value !== E, true);

    if (!win) return {
        complete: complete,
        win: E,
        result: complete ? options.draw : options.none
    }

    return {
        complete: true,
        win: win[0],
        result: win[0] === X ? options.X : options.O
    }
}

function checkComplete(state)
{
    return state.reduce((acc, value) => acc && value !== E, true);
}

function indent(depth)
{
    return Array(depth).fill('           ').join("");
}

function boardToLines(state, output, prefix, suffix)
{
    function mark(p) {
        const v = state[p];
        if (v === X)
            return ' X '
        else if (v === O)
            return ' O ';

        if (output) {
            if (output[p] === WIN)
                return ' * ';
            else if (output[p] === LOST)
                return ' ! ';
            else
                return ' ? '
        }

        return '   ';
    }
    function row(n) { return mark(n * 3) + '|' + mark(n * 3 + 1) + '|' + mark(n * 3 + 2); }
    const pre = prefix || "";
    const post = suffix || "";

    return {
        lines: [
            pre + row(0) + post,
            pre + row(1) + post,
            pre + row(2) + post
        ],
        sep: pre + '-----------' + post
    };
}

function boardToString(depth, state, output)
{
    const prefix = indent(depth);
    const p = boardToLines(state, output, prefix, "\n");

    return p.lines[0] + p.sep + p.lines[1] + p.sep + p.lines[2];
}

function printBoard(depth, state, output)
{
    console.log(boardToString(depth, state, output));
}

globalThis.boardToString = boardToString;
globalThis.printBoard = printBoard;

function minimax(depth, state, player, history, addState)
{
    function scoreForX(score, invScore) { return player === X ? score : invScore; }

    const winner = checkGameStatus(state, {
        X: scoreForX(+1, -1),
        O: scoreForX(-1, +1),
        draw: 0,
        none: null
    });

    if (winner.result != null) {
        // printGame(history);
        return winner.result;
    }

    let score = -Infinity;
    let move = null;
    let output = Array(9).fill(DRAW);
    const scores = Array(9).fill(0);

    for (let i = 0; i < 9; ++i) {
        if (state[i] !== E)
            continue;

        state[i] = player;
        history.push(state.slice(0));
        let currScore = -minimax(depth + 1, state, otherPlayer(player), history, addState);
        scores[i] = currScore;
        history.pop();

        // const winner = checkWin(state);
        // console.log(indent(depth), `${player ? 'X: ' : 'O: '} ${winner === true ? 'Win X' : winner === false ? 'Win O' : checkComplete(state) ? 'Draw' : '...'}; move: ${i}; score: ${currScore};`);
        // printBoard(depth, state/*, output*/);

        if (currScore > score) {
            score = currScore;
            move = i;
        }

        if (currScore > 0) {
            output[i] = scoreForX(WIN, LOST);
        }
        else if (currScore < 0) {
            output[i]  = scoreForX(LOST, WIN);
        }

        state[i] = E;
    }

    if (move === null)
        return 0;

    // console.log(`${indent(depth)}==> ${output}`);
    // console.log("=== " + player ? 'x' : 'o' + " ===");
    // console.log(`scores: [${scores.join(", ")}]`);
    // printBoard(0, state/*, output*/);
    if (depth === 0)
        console.log('zero');
    addState( state, output );
    return score;
}

function stateToIndex(state)
{
    let num = 3;
    for (let i = 0; i < 9; i++) {
        let digit = 0;
        switch (state[i]) {
            case X: digit = 2; break;
            case O: digit = 1; break;
        }

        num = num * 4 + digit;
    }

    return num;
}

function compareArrays(lhs, rhs)
{
    if (lhs.length != rhs.length)
        return false;

    return lhs.reduce((acc, value, index) => acc && value === rhs[index], true );
}

function choosePossibleMoves(state, output, player)
{
    const refVal = (player === X ? Math.max: Math.min)(...output);
    const possibleMoves = []

    output.forEach((value, index) => {
        if (value === refVal && state[index] === E)
            possibleMoves.push(index)
    })

    return possibleMoves
}

function aiPlayer(network)
{
    return function(state, player) {
        const output = network.activate(state);
        return choosePossibleMoves(state, output, player);
    }
}

function setPlayer(states)
{
    return function (state, player) {
        const id = stateToIndex(state);
        const data = states[id];

        if (!data)
            throw new Error(`state ${state} not found:\n${boardToString(0, state)}`);

        return choosePossibleMoves(state, data.output, player);
    }
}

function randomPlayer()
{
    return function(state, player) {
        const possibleMoves = []
        state.forEach( (value, index) => {
            if (value === E) possibleMoves.push(index)
        });
        return possibleMoves;
    };
}

function enumGames()
{
    let states = {}
    let dups = 0;

    function addState(state, output)
    {
        let id = stateToIndex(state);

        if (id in states) {
            // should be the same
            const old = states[id];

            if (!compareArrays(output, old.output)) {
                console.error(`Arrays are not equal: curr=${output}, old=${old.output}`);
                throw new Error("???");
            }
            dups++;
            return;
        }

        // printBoard(state, output);

        states[id] = {
            input: state.slice(0),
            output: output.slice(0)
        }
    }

    const initialState = Array(9).fill(E);

    minimax( 0, initialState, X, [], addState);

    // console.log("===", Object.keys(states).length, "---", dups);

    const trainingSet = [];

    for (const it in states) {
        const state = states[it];
        // console.log("Fun", state.input, "==>", state.output);
        trainingSet.push(state);
    }

    return {
        trainingSet,
        states: states
    }
}

function printGame(history)
{
    let line = Array(3).fill("");
    let sep  = [];

    for (let state of history) {
        const p = boardToLines(state, null, "   ");

        line[0] += p.lines[0];
        line[1] += p.lines[1];
        line[2] += p.lines[2];
        sep += p.sep;
    }

    console.log("%s\n%s\n%s\n%s\n%s\n", line[0], sep, line[1], sep, line[2]);
}

function playGame(state, A, B, player, expected, history)
{
    let winner = checkGameStatus(state);
    if (winner.complete) {
        // win or draw are acceptable
        if (winner.win === otherPlayer(expected)) {
            printGame(history);
            throw Error("Unexpected winner");
        }

        console.log('OK: ', stateToIndex(state));
        return;
    }

    const moves = A(state, player);

    for (const index in moves) {
        const move = moves[index];
        if (state[move] !== E)
            throw new Error('Occupied');

        state[move] = player;
        history.push(state.slice(0));
        playGame(state, B, A, otherPlayer(player), expected, history);
        history.pop();
        state[move] = E;
    }
}

function playAllGames(A, B)
{
    const state = Array(9).fill(E);
    const history = [];

    playGame(state, A, B, X, X, []);
    playGame(state, B, A, X, O, []);
}

const gameSet = enumGames();

// determined players
// playAllGames(setPlayer(gameSet.states), randomPlayer());

const { trainingSet } = gameSet;
const startTime = performance.now();

const trainingOptions = {
    rate: 0.05,
    iterations: 10 * 1000,
    error: 0.005,
    shuffle: false,
    log: 10,
    cost: Trainer.cost.MSE,
    schedule: {
        every: 10,
        do: (data) => {

            const timePassed = performance.now() - startTime;
            if (timePassed <= 2000)
                return;
            const iterationsLeft = trainingOptions.iterations - data.iterations;
            const timePerIteration = data.iterations / timePassed;

            console.log("%s) error=%s, rate=%s, left=%s, time=%s",
                data.iterations,
                data.error.toFixed(3),
                data.rate,
                iterationsLeft,
                util.timeSec(iterationsLeft * timePerIteration * 1000));
            // return false;
        }
    }
};

try {
    console.log('Begin training');
    trainer.train(trainingSet, trainingOptions);
    console.log('Complete');
    if (true) {
        const json = network.toJSON();
        const str = JSON.stringify(json);
        fs.writeFileSync('network.json', str);

        const fun = network.standalone();
        fs.writeFileSync('network.js', fun.toString());
    }
}
catch (e) {
    console.error(e);
    process.exit(1);
}

// var trainingSet =
// [
//     {
//         input: Array(9).fill(0),
//         output: [0,0,0,0,1,0,0,0,0]
//     },
// ]
// const o0 = network.activate(trainingSet[0].input);
// console.log(board(o0), bestMove(o0));
// ...
// const o1 = network.activate(trainingSet[0].input);
// console.log(board(o1), bestMove(o1));

playAllGames(aiPlayer(network), randomPlayer());
