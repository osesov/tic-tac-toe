import ai from './ai.js';
import util from './util.js';

class DOMView
{
    showState(model) {
        $(".app_block").each( (index, elem) => {
            const v = model.cellOwner(index);

            if (v === undefined)
                $(elem).text('')
            else if (v)
                $(elem).text('X')
            else
                $(elem).text('0')
        });
    }

    winner(win)
    {
        $(`.app_block[data-item="${win[0]}"], .app_block[data-item="${win[1]}"], .app_block[data-item="${win[2]}"]`)
            .addClass("win")
    }

    reset()
    {
        $('.win').removeClass('win');
    }
};

class NoView
{
    showState(model) {
    }

    winner(win)
    {
    }

    reset()
    {
    }
};

class Model
{
    constructor(view)
    {
        this.view = view;
        this.complete = false,
        this.cells = Array(9).fill(0),
        this.rest = 9
        this.winner_ = undefined
        this.steps = []
    }

    updateView()
    {
        this.view.showState(this)
    }

    isOccupied(index)
    {
        return this.cells[index] !== 0;
    }

    cellOwner(index)
    {
        return this.cells[index] === 0 ? undefined
            : this.cells[index] > 0;
    }

    randomMove()
    {
        const rand = Math.random();
        let n = Math.floor(rand * this.rest);
        for (let index = 0; index < 9; index++) {
            if (this.isOccupied(index))
                continue;

            if (n-- == 0)
                return index;
        }
        alert("Unexpected state")
        throw Error("Unexpected state");
    }

    checkGame()
    {
        const c = this.cells;
        const check = (p0, p1, p2) =>
        {
            const v0 = this.cellOwner(p0);
            const v1 = this.cellOwner(p1);
            const v2 = this.cellOwner(p2);

            return v0 !== undefined && v0 === v1 && v0 === v2 ? [p0, p1, p2] : undefined
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

        if (!win)
            return false

        this.complete = true;
        this.winner_ = win[0];
        this.view.winner(win)
        return true;
    }

    winner()
    {
        return this.cellOwner(this.winner_)
    }

    nextPlayer()
    {
        // odd steps - true, even steps = false
        return (this.rest % 2) !== 0;
    }

    move(index)
    {
        if (this.complete)
            throw Error('Game is complete')

        if (this.isOccupied(index))
            throw Error('Invalid move')

        const player = this.nextPlayer();

        this.cells[index] = player ? +1 : -1;
        --this.rest;
        this.steps.push(index);
        this.checkGame();

        if (this.rest == 0)
            this.complete = true;

        this.updateView();
    }

    /* returns array of +1, -1, 0 - see NeuralNetwork class  */
    getCurrentState()
    {
        return this.cells;
    }
}

class NeuralNetwork
{
    /*
     * 9: input layer. each input is a
     *    +1 - X
     *    -1 - 0
     *    0  - unoccupied
     *
     * 36: hidden layer
     * 9: output layer
     *    1 - win move
     *    0 - lose move
     *    0.5 neutral move
     *
     * **
     * Training
     *  input - current position
     *  output - each is set to 0.5, with current move set to +1 is X won, 0 if 0 win, 0.5 if no winner
     *
     * Use
     * Fox X - feed current position, in output find value closest to 1
     * For 0 - feed current position, in output find value closest to 0
     */
    constructor()
    {
        const { network, trainer } = ai.create_network(window.synaptic);
        this.network = network;
        this.trainer = trainer;

        // const { Layer, Network, Trainer, Architect } = window.synaptic;
        // this.network = new Architect.Perceptron(9, 36, 9);

        // // var inputLayer = new Layer(9);
        // // var hiddenLayer1 = new Layer(36);
        // // var hiddenLayer2 = new Layer(36);
        // // var outputLayer = new Layer(9);

        // // inputLayer.project(hiddenLayer1);
        // // hiddenLayer1.project(hiddenLayer2);
        // // hiddenLayer2.project(outputLayer);

        // // this.network = new Network({
        // //     input: inputLayer,
        // //     hidden: [hiddenLayer1, hiddenLayer2],
        // //     output: outputLayer
        // // });

        // this.trainer = new Trainer(this.network);
    }

    checkGame(steps, trainingSet)
    {
        const input = Array(9).fill(0);
        let turn = +1;
        let success = true;

        for (let step = 0; success && step < steps.length; ++step) {
            const actual = steps[step];
            const proposed = this.getMove_(turn > 0, input);
            if (proposed !== actual)
                success = false;

            input[actual] = turn;
            turn = -turn;
        }
        return success;
    }

    async playGame(learningRate, seen)
    {
        const view = new NoView();
        const model = new Model(view);
        const steps = []

        // play whole game first
        while(!model.complete) {
            let index = model.randomMove();
            steps.push(index);
            model.move(index);
        }

        const winner = model.winner()
        const outputValue = winner === undefined ? 0.5 : !winner ? 0 : 1;
        const restOutputValue = 0.5;
        let turn = +1;

        /// using trainer
        const trainingSet = [];

        /* reproduce steps and train model */
        const input = Array(9).fill(0);
        for (let step = 0; step < steps.length; ++step) {
            const output = Array(9).fill(restOutputValue);
            const index = steps[step];
            output[index] = outputValue;

            const elem =
            {
                input: input.map(x => x),
                output: output
            };

            trainingSet.push(elem);

            input[index] = turn;
            turn = -turn;
        }

        return this.trainer.trainAsync(trainingSet)
            .then(() => this.checkGame(steps, trainingSet))
            ;

/*
        /// old code
        const n = await this.digest(steps);

        // if (seen.has(n))
        //     return Promise.resolve(false);
        // seen.add(n);

        // X win = the move marked as 1, the rest as 0.5
        // X lose = the move marked as 0, the rest as 0.5

        const winner = model.winner()
        const outputValue = winner === undefined ? 0.5 : !winner ? 0 : 1;
        const restOutputValue = 0.5;
        let continue_training = true;

        for (let i = 0; continue_training && i < 20000; i++) {

            const input = Array(9).fill(0);
            let turn = +1;

            // reproduce steps and train model
            for (let step = 0; step < steps.length; ++step) {
                const output = Array(9).fill(restOutputValue);
                const index = steps[step];

                output[index] = outputValue;
                this.network.activate(input);
                this.network.propagate(learningRate, output);

                input[index] = turn;
                turn = -turn;
            }

            // check the game
            if (true) {
                const input = Array(9).fill(0);
                let turn = +1;
                continue_training = false;

                // reproduce steps and train model
                for (let step = 0; !continue_training && step < steps.length; ++step) {
                    const actual = steps[step];
                    const proposed = this.getMove_(turn > 0, input);
                    if (proposed !== actual)
                        continue_training = true;

                    input[actual] = turn;
                    turn = -turn;
                }
            }
        }
        */
        return Promise.resolve(true);
    }

    async train(progress)
    {
        const learningRate = .3;
        const seen = new Set();

        const step = async (index) => {
            console.log("Step " + index);
            await this.playGame(learningRate, seen);
            if (!progress(index))
                return Promise.resolve();

            return Promise.resolve().then( () => step(index + 1));
        };

        return Promise.resolve()
            .then(() => step(0))
    }

    getMove_(player, state)
    {
        const output = this.network.activate(state);
        const isBetter = player ? (a,b) => b > a : (a,b) => b < a;
        let bestIndex = undefined;

        for (let index = 0; index < 9; index++) {
            if (state[index] != 0) // occupied
                continue;

            if (bestIndex === undefined)
                bestIndex = index;

            else if (isBetter(output[bestIndex], output[index]))
                bestIndex = index;
        }

        return bestIndex;
    }

    getMove(model)
    {
        const player = model.nextPlayer()
        const state = model.getCurrentState();
        return this.getMove_(player, state);
    }

    async digest(steps)
    {
        const input = new ArrayBuffer(steps.length);
        const view = new DataView(input);
        steps.forEach( (e, index) => view.setUint8(index, e));
        const hash = await crypto.subtle.digest('SHA-256', input);
        const resultView = new DataView(hash);
        return resultView.getFloat64(0);
    }

    fromJSON(json)
    {
        const { Network } = window.synaptic;
        const newNetwork = Network.fromJSON(json);

        if (newNetwork.inputs() != 9 || newNetwork.outputs() != 9) {
            window.alert(`Invalid network`);
            return;
        }

        this.network = newNetwork;
    }
}

class Controller
{
    constructor(view)
    {
        this.view = view;
        this.ai = new NeuralNetwork();

    }

    newGame()
    {
        this.model = new Model(this.view)
        this.model.updateView();
        this.view.reset()
    }

    uiMove(elem)
    {
        const index = Number($(elem).attr('data-item'));
        this.model.move(index);
    }

    randomMove()
    {
        if (this.model.complete)
            return;
        const index = this.model.randomMove();
        this.model.move(index);
    }

    async aiMove()
    {
        if (this.model.complete)
            return;

        const index = this.ai.getMove(this.model);
        this.model.move(index);
    }

    train()
    {
        let n = $('#trainNumber').val()

        if (n === undefined || n === '') {
            n = undefined;

            $('#restTime').parent().hide()
            $('#totalTime').parent().hide()
        }

        else {
            n = Number(n);
            if (Number(n) <= 0)
                return
            $('#restTime').parent().show()
            $('#totalTime').parent().show()
        }

        const startTime = performance.now();
        let stop = false
        let progressTime

        $('#cover').show();
        $(document).on( "keydown", e => {
            if (e.key === "Escape") {
                console.log("Esc!");
                stop = true
            }
        })
        this.ai.train((step) => {
            const now = performance.now();
            const passedTime = now - startTime;
            const keepDoing = !stop && (!n || step < n);
            if (passedTime - progressTime < 100)
                return keepDoing;
            progressTime = passedTime;
            const passedTimeSec = (passedTime / 1000).toFixed(0);
            let unitTime, totalTime, totalTimeSec, restTime, restTimeSec
            let totalTimeText, restTimeText
            if (n !== undefined) {
                unitTime = passedTime / (step + 1);
                totalTime = n * unitTime;
                totalTimeSec = (totalTime / 1000).toFixed(0)

                restTime = totalTime - passedTime
                restTimeSec = (restTime / 1000).toFixed(0)

                totalTimeText = util.timeSec(totalTimeSec)
                restTimeText = util.timeSec(restTimeSec)
            }

            else {
                restTimeText = totalTimeText = '';
            }

            if (n !== undefined) {
                $('#status').text( `${step}/${n} - ${(step * 100 / n).toFixed(0)}%`);
                $('#restTime').text(restTimeText)
                $('#totalTime').text(totalTimeText)
            }
            else {
                $('#status').text( `${step}`);
                $('#restTime').text('')
                $('#totalTime').text('')
            }
            $('#passedTime').text(util.timeSec(passedTimeSec))
            return keepDoing
        },
        () => stop).then( () => {
            $('#cover').hide();
            $(document).off( "keydown" );
        })
    }

    async saveWithPicker()
    {
        const pickerOpts = {
            types: [
                {
                    description: 'Network files (json)',
                    accept: {
                        'application/json': ['.json']
                    }
                },
            ],
            excludeAcceptAllOption: true,
            multiple: false
        };


        const fileHandle = await window.showSaveFilePicker(pickerOpts);
        const file = await fileHandle.createWritable();
        try {
            const data = this.ai.network.toJSON();
            await file.write(JSON.stringify(data));
        }

        finally {
            await file.close();
        }
    }

    saveWithLink()
    {
        const data = this.ai.network.toJSON();

        if (this.oldSaveFile !== undefined) {
            URL.revokeObjectURL(this.oldSaveFile);
            this.oldSaveFile = undefined
        }

        var a = document.createElement("a");
        var file = new Blob([JSON.stringify(data)], {type: 'application/json'});
        a.href = URL.createObjectURL(file);
        a.download = "tic-tac-toe.json";
        a.click();

        this.oldSaveFile = file;
    }

    async _loadFromFile(file)
    {
        const text = await file.text();
        const json = JSON.parse(text);
        this.ai.fromJSON(json);
    }

    loadSelector(target)
    {
        const fileList = target.files;

        if (fileList.length < 0)
            return;

        const file = fileList[0];
        this._loadFromFile(file);

        // const reader = new FileReader();
        // console.log(fileList);
        // $(reader).on('load', (event) => {
        //     const data = event.target.result;
        //     const parsedJson = JSON.parse(new TextDecoder().decode(data));
        //     this.ai.fromJSON(parsedJson);
        //     console.log('Done');
        // })
        // reader.readAsArrayBuffer(fileList[0]);
    }

    async loadButton()
    {
        const pickerOpts = {
            types: [
                {
                    description: 'Network files (json)',
                    accept: {
                        'application/json': ['.json']
                    }
                },
            ],
            excludeAcceptAllOption: true,
            multiple: false
          };


        const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
        const file = await fileHandle.getFile();
        this._loadFromFile(file);
    }
}

$(document).ready(
    () => {
        const view = new DOMView;
        const controller = new Controller(view);
        controller.newGame();

        $(".app_block").click(ev => controller.uiMove(ev.target))
        $("#restart").click( () => controller.newGame());
        $("#randomMove").click( () => controller.randomMove());
        $("#aiMove").click( () => controller.aiMove());
        $("#trainButton").click(() => controller.train() );
        if (!window.showOpenFilePicker) {
            $("#load").click(() => controller.loadButton() );
            $("#file-selector").hide();
        } else {
            $("#load").hide();
            $('#file-selector').on('change', (event) => controller.loadSelector(event.target))
        }

        if (window.showSaveFilePicker) {
            $("#save").click(() => controller.saveWithPicker() );
        }
        else {
            $("#save").click(() => controller.saveWithLink() );
        }
    }
)
