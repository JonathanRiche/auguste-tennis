# Auguste Tennis

A very simple 3D tennis game for toddlers on Android, made for Auguste.
Swing at balls from a friendly ball machine, or play back and forth with a computer friend, with a gamepad (Backbone, Xbox, PlayStation or any controller Android recognises) or by touch.

## Install

Download the APK from the [latest release](https://github.com/JonathanRiche/auguste-tennis/releases/latest) on the phone and open it.
Android will ask you to allow installing from your browser or file manager the first time.

Later versions can be installed from inside the game: hold the **Grown-ups** button on the title screen (or hold Y on the controller), then choose **Check for update**.
The first time, Android asks you to allow Auguste Tennis to install apps.

## Playing

- Pick a player (Tennis Kid, Puppy, Kitty, Bear, Dino, Bunny, Robot), then a game:
  - **Ball Machine**: the machine shoots balls at you to practise your swing. Hit balls can pop the balloons on the other side.
  - **Play a Friend**: hit the ball back and forth with a computer friend (Robot, Bunny, Puppy, Bear, Dino). The friend often misses, which wins you a point.
- Each game has five levels; each level is 10 balls. Stars show how many came back: one star for playing, two for half, three for most of them. All levels are open from the start.
- By default the player runs to the ball by itself and the timing is very forgiving: press any button a little early and the swing waits for the ball. Nothing is lost by missing.

| Control | Gamepad | Touch |
|---|---|---|
| Swing | A, B, X, Y, bumpers or triggers | Tap the court |
| Move (if "Moving to the ball" is not "By itself") | Left stick or d-pad | Hold the left or right side of the screen |
| Aim (optional) | Push the stick left or right as you hit | |
| Pause | Start | Pause button |
| Menus | Stick or d-pad, A to choose, B to go back | Tap |
| Grown-ups area | Hold Y on the title screen | Hold the Grown-ups button |

Grown-ups options: moving to the ball (by itself, with help, stick only), hitting (very easy, easy, tricky, swings by itself), ball speed, balls per game, sound and the update check.

## Building

Needs bun, JDK 17, Gradle 8.11+ and the Android SDK (platform 36, build-tools 35.0.0).

```sh
export ANDROID_HOME=/path/to/android-sdk JAVA_HOME=/path/to/jdk-17 GRADLE_BIN=/path/to/gradle
./build.sh        # writes dist/auguste-tennis-<version>.apk
```

The same exports can live in an untracked `local-env.sh`. Release signing is read from `~/.config/auguste-tennis/signing.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`); without it the APK is debug-signed. Every release must be signed with the same key, or it will not install over the previous version.

To release: bump `versionCode` and `versionName` in `android/app/build.gradle.kts`, build, and attach the APK to a GitHub release tagged `v<versionName>`. The in-app updater reads the latest release and installs its `.apk` asset when its tag is newer than the installed version.

## Layout

- `game/` is the game itself: three.js, bundled by bun into one script. `game/src/main.js` holds the game loop, ball physics, levels and menus, `models.js` the characters and ball machine, `court.js` the court and park, `input.js` the controls and `audio.js` the synthesised sounds.
- `android/` is a small Java shell that shows the game full screen, passes gamepad input to it, and (`Updater.java`) installs new releases from GitHub.

To try the game in a desktop browser, run `bun run build` in `game/` and open `android/app/src/main/assets/index.html` (arrow keys, Enter, Space to swing, Esc, O for options).
