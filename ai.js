

function create_network(synaptic)
{
    const { Layer, Network, Neuron, Trainer, Architect } = synaptic;
    const network = new Architect.Perceptron(9, 36, 9);
    const trainer = new Trainer(network);


    const layers = [ network.layers.input, ...network.layers.hidden, network.layers.output]
    layers.forEach(layer => {
        layer.set({ squash: Neuron.squash.RELU })
    });

    return { network, trainer };
}

export default {
    create_network
}
