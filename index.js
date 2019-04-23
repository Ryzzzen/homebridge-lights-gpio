var Service, Characteristic;

const Gpio = require('pigpio').Gpio;

module.exports = function(homebridge) {
  console.log("Homebridge API version:", homebridge.version);

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-lights-gpio', 'GPIOLightPlatform', GPIOLightPlatform);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function GPIOLightPlatform(log, config, api) {
  log("GPIO LightPlatform Init");

  this.accessories = [];
  this.log = log;

  this.service = config.service;
  this.name = config.name;

  this.ip = config.ip;

  this.cache = {};

  if (config.brightness)
    this.brightness = config.brightness;

  if (config.status)
    this.status = config.status;

  if (config.colors)
    this.colors = { hue: 0, saturation: 0 };

  this.pin = config.pin || 1;

  this.gpio = new Gpio(this.pin, { mode: Gpio.OUTPUT });
  console.dir(this);
}

GPIOLightPlatform.identify = function(callback) {
  this.log('Identify requested!');
  callback();
};

var api = {
  getPowerState: function(callback) {
    try {
      if (this.gpio.getPwmDutyCycle() > 0)
        callback(null, true);
      else callback(null, false);

      this.log('Power is currently %s', this.gpio.getPwmDutyCycle() > 0 ? 'ON' : 'OFF');
    }
    catch(err) {
      this.log('getPowerState() failed: %s', err.message);
      callback(err);
    }
  },
  setPowerState: function(state, callback) {
      this.cache.state = state;

      try {
        if (state) {
          this.cache.brightness = 255;
          this.gpio.pwmWrite(255);
        }
        else {
          this.cache.brightness = 0;
          this.gpio.pwmWrite(0);
        }

        callback(null, state);
      }
      catch(err) {
        this.log('setPowerState() failed: %s', err.message);
        callback(err);
      }
  },
  getBrightness: function(callback) {
      if (!this.brightness) {
          this.log.warn("Ignoring request; No 'brightness' defined.");
          callback(new Error("No 'brightness' defined in configuration"));
          return;
      }

      this.log('Brightness is currently at %s %', this.gpio.getPwmDutyCycle() || this.cache.brightness || 0);
      callback(null, this.gpio.getPwmDutyCycle() || this.cache.brightness || 0);
  },
  setBrightness: function(level, callback) {
      if (!this.brightness) {
          this.log.warn("Ignoring request; No 'brightness' defined.");
          callback(new Error("No 'brightness' defined in configuration"));
          return;
      }

      this.cache.brightness = level;
      this.gpio.pwmWrite(level * 255 / 100);

      this.log('setBrightness() successfully set to %s %', level);
      callback();
  }
};

GPIOLightPlatform.prototype.getServices = function() {
  var informationService = new Service.AccessoryInformation();

  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'Ryzzzen')
    .setCharacteristic(Characteristic.Model, 'homebridge-lights-http')
    .setCharacteristic(Characteristic.SerialNumber, Date.now());

  switch (this.service) {
    case 'Light':
        this.log('Creating Lightbulb');
        var lightbulbService = new Service.Lightbulb(this.name);

        if (this.status) {
            lightbulbService
                .getCharacteristic(Characteristic.On)
                .on('get', api.getPowerState.bind(this))
                .on('set', api.setPowerState.bind(this));
        } else {
            lightbulbService
                .getCharacteristic(Characteristic.On)
                .on('set', api.setPowerState.bind(this));
        }

        // Handle brightness
        if (this.brightness) {
            this.log('... Adding Brightness');
            lightbulbService
                .addCharacteristic(new Characteristic.Brightness())
                .on('get', api.getBrightness.bind(this))
                .on('set', api.setBrightness.bind(this));
        }

        if (this.color) {
            this.log('... Adding colors');
            lightbulbService
                .addCharacteristic(new Characteristic.Hue())
                .on('get', api.getHue.bind(this))
                .on('set', api.setHue.bind(this));

            lightbulbService
                .addCharacteristic(new Characteristic.Saturation())
                .on('get', api.getSaturation.bind(this))
                .on('set', api.setSaturation.bind(this));
        }

        return [informationService, lightbulbService];
    default:
      return [informationService];
    }
};

GPIOLightPlatform.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  accessory.reachable = true;

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identifying");
    callback();
  });

  if (accessory.getService(Service.Lightbulb)) {
    let lightbulbService = accessory.getService(Service.Lightbulb);

    if (this.status) {
        lightbulbService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));
    } else {
        lightbulbService
            .getCharacteristic(Characteristic.On)
            .on('set', this.setPowerState.bind(this));
    }

    if (this.brightness) {
        this.log('... Adding Brightness');
        lightbulbService
            .addCharacteristic(new Characteristic.Brightness())
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));
    }

    if (this.color) {
        this.log('... Adding colors');
        lightbulbService
            .addCharacteristic(new Characteristic.Hue())
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        lightbulbService
            .addCharacteristic(new Characteristic.Saturation())
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));
    }
  }

  this.accessories.push(accessory);
};
