'use strict';

angular
  .module('hackday')
  .controller('MainCtrl', function($scope, $q, BeatDetector, Sample) {

    var context = new AudioContext(),
      bufferSize = 2048,
      soundArrayLeft = [],
      audioInput,
      recorder,
      getUserMediaOpts;

    getUserMediaOpts = {
      audio: {
        mandatory: {
          echoCancellation: false,
          googEchoCancellation: false,
          googEchoCancellation2: false,
          googAutoGainControl: false,
          googAutoGainControl2: false,
          googNoiseSuppression: false,
          googNoiseSuppression2: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false
        },
        optional: []
      },
      video: false
    };

    // Sounds samples
    var sounds = [{
      name: 'kick',
      url: 'https://d11ofhkcovlw0l.cloudfront.net/soundbanks/808-kit/036-Kick_808.ogg'
    }, {
      name: 'hh-closed',
      url: 'https://d11ofhkcovlw0l.cloudfront.net/soundbanks/808-kit/042-HH-Closed_808.ogg'
    }, {
      name: 'snare',
      url: 'https://d11ofhkcovlw0l.cloudfront.net/soundbanks/808-kit/038-Snare_808.ogg'
    }];

    // Some data for test
    var beatsArray = [{
      startTime: 0,
      sound: 'kick'
    }, {
      startTime: 500,
      sound: 'hh-closed'
    }, {
      startTime: 500,
      sound: 'snare'
    }, {
      startTime: 1000,
      sound: 'snare'
    }, {
      startTime: 1500,
      sound: 'kick'
    }];

    $scope.isRecording = false;

    $scope.playBeats = function() {
      playBeats(beatsArray);
    };

    $scope.toggleRecord = function() {
      var record;

      if (!$scope.isRecording) {
        startRecord();
        $scope.isRecording = true;
      }
      else {
        var record = stopRecord();
        $scope.isRecording = false;
        BeatDetector.lowPassFilter(record)
          .then(function(audioBuffer) {
            var playSound = context.createBufferSource();
            playSound.buffer = audioBuffer;
            playSound.connect(context.destination);
            playSound.start(0);
            return BeatDetector.getPeaks(audioBuffer, 1);
          })
          .then(function(peaks) {
            console.log(peaks)
          });
      }
    };

    function storeBuffer(audioEvent) {
      soundArrayLeft.push(new Float32Array(audioEvent.inputBuffer.getChannelData(0)));
    }

    function startRecord() {
      navigator.getUserMedia(getUserMediaOpts,
        function(stream) {
          audioInput = context.createMediaStreamSource(stream);
          recorder = context.createScriptProcessor(bufferSize, 1, 1);
          recorder.onaudioprocess = storeBuffer;
          audioInput.connect(recorder);
          recorder.connect(context.destination);
        },
        function(err) {
          throw new Error(err);
        });
    }

    function stopRecord() {
      var resultLength = Math.ceil(soundArrayLeft.length * bufferSize),
        resultSoundArray = new Float32Array(resultLength),
        offset = 0,
        audioBuffer,
        i;

      // Disconnect nodes
      audioInput.disconnect();
      recorder.disconnect();

      // Clean up data
      for (i = 0; i < soundArrayLeft.length; i++) {
        resultSoundArray.set(soundArrayLeft[i], offset);
        offset += soundArrayLeft[i].length;
      }
      soundArrayLeft = [];

      audioBuffer = context.createBuffer(2, resultSoundArray.length, context.sampleRate);
      audioBuffer.getChannelData(0).set(resultSoundArray);
      audioBuffer.getChannelData(1).set(resultSoundArray);

      // For debug, play record
      playSound(audioBuffer);

      return audioBuffer;
    }

    function playSound(audioBuffer, atTime) {
      var playSound = context.createBufferSource();
      playSound.buffer = audioBuffer;
      playSound.connect(context.destination);
      playSound.start(atTime / 1000 + context.currentTime || 0);
    }

    function playBeats(beatsArray) {

      // Load audio buffers
      var promises = sounds.map(function(sound) {
        return Sample.getBuffer(sound.url)
          .then(Sample.decodeAudioData)
          .then(function(decodedBuffer) {
            sound.buffer = decodedBuffer;
            return decodedBuffer;
          });
      });

      $q.all(promises)
        .then(function() {
          var i = 0;
          beatsArray.forEach(function(beat) {
            playSound(_.find(sounds, { name: beat.sound }).buffer, beat.startTime);
            i++;
          })
        });
    }
  });
