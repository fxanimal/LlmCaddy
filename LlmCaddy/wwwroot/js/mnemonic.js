const adjectives = [
    'ancient', 'atomic', 'bionic', 'bitter', 'blank', 'blazing', 'blind', 'bold', 'brave', 'breezy',
    'bright', 'bronze', 'calm', 'clever', 'cold', 'cosmic', 'crazy', 'crisp', 'crypto', 'cyan',
    'daring', 'dark', 'dawn', 'decent', 'deep', 'dense', 'divine', 'dry', 'eager', 'early',
    'elastic', 'electric', 'elegant', 'epic', 'eternal', 'exotic', 'fancy', 'fast', 'fatal', 'fierce',
    'final', 'first', 'flashy', 'flat', 'flying', 'formal', 'fresh', 'frosty', 'frozen', 'gentle',
    'giant', 'glamorous', 'global', 'golden', 'grand', 'gray', 'great', 'green', 'grim', 'heavy',
    'hidden', 'hollow', 'holy', 'honest', 'huge', 'humble', 'hyper', 'icy', 'infinite', 'inner',
    'ionic', 'iron', 'jolly', 'jungle', 'keen', 'kinetic', 'light', 'linear', 'liquid', 'lively',
    'local', 'lone', 'lucky', 'lunar', 'magic', 'magnetic', 'mega', 'mellow', 'modern', 'mystic',
    'native', 'natural', 'neon', 'neutral', 'new', 'noble', 'nomad', 'nordic', 'odd', 'silent'
];

const colors = [
    'amber', 'apricot', 'aqua', 'avocado', 'azure', 'banana', 'beige', 'berry', 'black', 'blue',
    'blush', 'bone', 'brass', 'brick', 'bronze', 'brown', 'bubblegum', 'burgundy', 'butter', 'camel',
    'canary', 'caramel', 'charcoal', 'cherry', 'chestnut', 'chocolate', 'citron', 'clover', 'cobalt', 'cocoa',
    'copper', 'coral', 'cornflower', 'cream', 'crimson', 'denim', 'desert', 'emerald', 'espresso', 'fern',
    'firebrick', 'flax', 'forest', 'fuchsia', 'ginger', 'gold', 'grape', 'graphite', 'gray', 'green',
    'hazel', 'heather', 'honey', 'hotpink', 'indigo', 'ink', 'iris', 'ivory', 'jade', 'jasmine',
    'khaki', 'lavender', 'lemon', 'lilac', 'lime', 'magenta', 'mahogany', 'mango', 'maroon', 'mauve',
    'mint', 'moss', 'mustard', 'navy', 'oatmeal', 'ochre', 'olive', 'onyx', 'opal', 'orange',
    'orchid', 'peach', 'pear', 'pearl', 'periwinkle', 'pewter', 'pink', 'plum', 'pumpkin', 'purple',
    'ruby', 'salmon', 'sapphire', 'scarlet', 'silver', 'tan', 'teal', 'tomato', 'violet', 'white'
];

const nouns = [
    'anchor', 'apple', 'arrow', 'astronaut', 'atlas', 'avalanche', 'badger', 'beacon', 'bear', 'beetle',
    'bison', 'blade', 'boulder', 'breeze', 'camel', 'canyon', 'castle', 'cheetah', 'cliff', 'cloud',
    'comet', 'compass', 'condor', 'crater', 'crystal', 'cyborg', 'dolphin', 'dragon', 'eagle', 'earth',
    'echo', 'eclipse', 'engine', 'falcon', 'fender', 'forest', 'fossil', 'fox', 'galaxy', 'glacier',
    'glitch', 'grizzly', 'hammer', 'hawk', 'horizon', 'hurricane', 'island', 'jaguar', 'jungle', 'jupiter',
    'koala', 'laser', 'leopard', 'lion', 'lizard', 'locust', 'magma', 'magnet', 'mammoth', 'mantis',
    'matrix', 'meteor', 'mirror', 'monkey', 'moon', 'mountain', 'nebula', 'neuron', 'ocean', 'orbit',
    'panther', 'penguin', 'phoenix', 'photon', 'pilot', 'pixel', 'planet', 'prism', 'pulsar', 'python',
    'quantum', 'quasar', 'radar', 'raven', 'river', 'robot', 'rocket', 'rover', 'satellite', 'scout',
    'shadow', 'shark', 'shield', 'sonic', 'spark', 'sphere', 'sphinx', 'star', 'storm', 'vortex'
];

function cyrb128(str) {
    let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 502494819;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h4 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function uuidToWords(uuid) {
    const hashes = cyrb128(uuid);
    const adjIndex = hashes[0] % adjectives.length;
    const colorIndex = hashes[1] % colors.length;
    const nounIndex = hashes[2] % nouns.length;
    return `${adjectives[adjIndex]}-${colors[colorIndex]}-${nouns[nounIndex]}`;
}