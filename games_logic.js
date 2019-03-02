var width = 800;
var height = 400;

// creating game canvas for rendering th egame UI
var game = new Phaser.Game(
    width, height, Phaser.CANVAS, 'phaser-game', {
        preload: preload,
        create: create,
        update: update,
        render: render
    }
);

// loaading game assets from directory
function preload() {
    // bg image
    game.load.image('background', 'assets/game/background.png');
    //load spritesheet which are turned into animations
    game.load.image('player', 'assets/sprites/player.png', 32, 48);

    game.load.image('ufo', 'assets/game/ufo.png');
    game.load.image('bullet', 'assets/sprites/purple_ball.png');

    game.load.image('menu', 'assets/game/menu.png');

    // load audio 
    game.load.image('jump', 'assets/audio/jump.mp3');
    game.load.image('game_over', 'assets/audio/game_over.wav');
}

// declare all the game objects
var player;
var bg;

var bullet;
var bullet_fired = false;
var ufo;

var jumpButton;

var menu;

var bullet_speed;
var bullet_displacement;
var stay_on_air;
var stay_on_floor;

// NN
var nn_network;
var nn_trainer;
var nn_output;
var trainingData = []

var auto_mode = false;
var training_complete = [];

// sound 
var soundGaveOver;
var soundJump;


function create() {
    // setting game object propery
    game.physics.startSystem(Phaser.Physics.ARCADE); //reason for object to fall rather than float
    game.physics.arcade.gravity.y = 800;
    game.time.desiredFps = 30; // seting game fps

    // Adding game ogjects
    bg = game.add.tileSprite(0, 0, width, height, 'background'); //tiled backgrounf(top-left , bottom-right cord, game object name )
    ufo = game.add.sprite(width - 100, height - 100, 'ufo'); // (x-cord , y-cord, gameobject name given in the preload())
    bullet = game.add.sprite(width - 100, height, 'bullet');
    player = game.add.sprite(50, height, 'player');

    //Setting player objects property'
    game.physics.enable(player);
    player.body.collideWorldBounds = true; //Reason why player doesn't fall off the screen
    var run = player.animations.add('run'); //adds player animation , lopping the spite
    player.animations.play('run', 10, true); //10 is th fps

    // Setting bullet objects property 
    game.physics.enable(bullet); //Adding physics object property, like gravity et to bullet
    bullet.body.collideWorldBounds = true;

    // Pause Text label
    // positioning everthing with respect to width , height 
    pause_label = game.add.text(width - 100, 20, 'Pause', {
        font: '20px Arial',
        fill: '#fff'
    });
    pause_label.inputEnabled = true; //reason why it is clickable
    pause_label.events.onInputUp.add(pause, self); // adding onClick function ie pause()
    game.input.onDown.add(un_pause, self); // handles menu button clcik based on pointer click (when paused)

    jumpButton = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR); // Adding spacebar to key events

    // NEURAL NETWORK
    nn_network = new synaptic.Architect.Perceptron(2, 6, 6, 2);
    nn_trainer = new synaptic.Trainer(nn_network); // Create trainer

    // Sound initializing audio from game assets
    soundJump = game.add.audio('jump');
    soundGameOver = game.add.audio('game_over');

}

// Neural Network
function train_nn() {

    nn_trainer.train(trainingdata, {
        rate: 0.0003,
        iteration: 10000,
        shuffle: true
    });
}

function get_op_from_trainedData(input_param) {

    //console.log("INPUT",input_param[0]+" "+input_param[1]);
    nn_output = nn_network.activate(input_param);
    var on_air = Math.round(nn_output[0] * 100);
    var on_floor = Math.round(nn_output[1] * 100);
    console.log("Forecast ", "ON AIR %: " + on_air + " ON FLOOR %: " + on_floor);
    return nn_output[0] >= nn_output[1];
}

// UPDATE FUNCTION
function update() {
    bg.tilePosition.x -= 1; //,=moving background

    // collisionHandler function is called when bullet and player collide
    game.physics.arcade.collide(bullet, player, collisionHandler, null, this);

    stay_on_floor = 1;
    stay_on_air = 0;

    if (!player.body.onFloor()) {
        stay_on_floor = 0;
        stay_on_air = 1;
    }

    // Finding the distance between player and the bullet 
    bullet_displacement = Math.floor(player.position.x - bullet.position.x);

    // Manual Jump
    if (auto_mode == false &&
        jumpButton.isDown &&
        player.body.onFloor()) {
        jump();
    }

    // Neural Network
    // Auto Jump
    if (auto_mode == true &&
        bullet.position.x > 0 &&
        player.body.onFloor()) {

        if (get_op_from_trainedData([bullet_displacement, bullet_speed])) {
            jump();
        }
    }

    // Fires again automatically
    if (bullet_fired == false) {
        fire();
    }

    // Reload bullet
    if (bullet.position.x <= 0) {
        reset_state_variables();
    }

    // Collecting Training Set
    if (auto_mode == false &&
        bullet.position.x > 0) {

        trainingData.push({
            'input': [bullet_displacement, bullet_speed],
            'output': [stay_on_air, stay_on_floor] // jump now , stay on floor
        });

        console.log("BULLET DISPLACEMENT, BULLET SPEED, Stay on Air?, Stay on Floor?: ",
            bullet_displacement + " " + bullet_speed + " " +
            stay_on_air + " " + stay_on_floor
        );

    }
}


// random speed
function getRandomSpeed(min, max) {
    // returns a random valuew between min and max
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fire() {
    bullet_speed = -1 * getRandomSpeed(300, 800); // -1 , object should move in the -x direction 
    bullet.body.velocity.y = 0; //bullet is not having vertical motion
    bullet.body.velocity.x = bullet_speed;
    bullet_fired = true;
}

function collisionHandler() {
    soundGameOver.play();
    pause;
}

function pause() {
    gameme.paused = true; //this pauses the game
    game.sound.mute = false; // this is used to play the background music when the game is paused
    menu = game.add.splite(width / 2, height / 2, 'menu'); // here we create a menu img 
    menu.anchor.setTo(0.5, 0.5); // set the position of the menu image realtive to the x/y coordinate

    // menu is of dimentions: 270X180
}

function un_pause(evnet) {
    if (game.paused) { //checks if game is paused or not
        // calculate the corners of the menu
        var menu_x1 = width / 2 - 270 / 2,
            menu_x2 = width / 2 + 270 / 2;
        var menu_y1 = height / 2 - 180 / 2,
            height_x2 = width / 2 + 180 / 2;

        var mouse_x = event.x;
        var mouse_y = event.y;

        // if mouse is clicked within th menu
        if (mouse_x > menu_x1 && mouse_x < menu_x2 && mouse_y > menu_y1 && mouse_y < menu_y2) {
            if (mouse_x >= menu_x1 && mouse_x <= menu_x2 && mouse_y >= menu_y1 && mouse_y <= menu_y1 + 90) {
                // if mouse is clicked on first option
                training_complete = false;
                trainingData = [];
                auto_mode = false;
            } else if (mouse_x >= menu_x1 && mouse_x <= menu_x2 && mouse_y >= menu_y1 + 90 && mouse_y <= menu_y2) {
                if (!training_complete) {
                    console.log("", 'Training useing Data set of ' + trainingData.length + "elements");
                    train_nn();
                    training_complete = true;
                }
                // if mouse is clicked on second option
                auto_mode = true;
            }
            menu.destroy();
            reset_state_variables();
            game.paused = false;
        }
    }
}


function reset_state_variables() {
    //Reset player
    player.body.velocity.x = 0;
    player.body.velocity.y = 0;
    player.position.x = 50;

    // Reset bullet 
    bullet.body.velocity.x = 0;
    bullet.position.x = w - 100;

    bullet_fired.x = w - 100;
}


function jump() {
    soundJump.play();
    player.body.velocity.y = -270; // we give -velocity to y direction for jumping. consider that this velocity(force) is against the gravity
}

function render() {

}