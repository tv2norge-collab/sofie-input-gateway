# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.1](https://github.com/nrkno/sofie-input-gateway/compare/v0.1.0...0.1.1) (2023-02-09)

### Bug Fixes

- handle disconnected xkeys ([2260b38](https://github.com/nrkno/sofie-input-gateway/commit/2260b3894913132b7d8f531ec8bfdf136815781a))
- use a single way of attaching event listeners ([952cef5](https://github.com/nrkno/sofie-input-gateway/commit/952cef55e48568c9ad28272793e58fa7302a0f81))


## [0.1.0](https://github.com/nrkno/sofie-input-gateway/compare/v0.0.0...v0.1.0) (Wed Jan 11 2023)

### Fixes

- improve shutdown handling [7fe7bb1](https://github.com/nrkno/sofie-input-gateway/commit/7fe7bb1f0643b0a9bca2b2d5f19522112b883419)
- win32 packaging assets/node bindings [2425889](https://github.com/nrkno/sofie-input-gateway/commit/24258897cfc9dd52e2e9c83dac070a79d0c62fe7)
- don't build font files into the binary [1eac1c8](https://github.com/nrkno/sofie-input-gateway/commit/1eac1c85797650a433b81a55b7c97398fb0ce084)
- use JobQueueWithClasses instead of SendQueue [9bad146](https://github.com/nrkno/sofie-input-gateway/commit/9bad146efe1be8e0129c7563d92cf3024447c1f9)
- remove more copied interfaces [cec112f](https://github.com/nrkno/sofie-input-gateway/commit/cec112f8c026f46e61dff691d03c496ab4978da1)
- **(MIDI)** disconnection detection [6a5da14](https://github.com/nrkno/sofie-input-gateway/commit/6a5da14d7a4d4e361c4c5e20554aa86581365198)
- **(InputGateway)** only one of the feedbacks updates when multiple mounted triggers per action [c02c266](https://github.com/nrkno/sofie-input-gateway/commit/c02c2665abc740dcc5db914f3a383dd0310d6f11)
- **(StreamDeck)** re-emit error to restart the device if something happens [b171438](https://github.com/nrkno/sofie-input-gateway/commit/b171438869311594a9c7334f9752d3d53e2c3449)
- **(InputGateway)** make gateway report correct package version number [fd31ab8](https://github.com/nrkno/sofie-input-gateway/commit/fd31ab81f3f280061764ef6c2cf301a3e105f16c)
- some codestyle improvements [c18eb54](https://github.com/nrkno/sofie-input-gateway/commit/c18eb5465672b163420c65b52c2340d707b60ed4)
- handle core reconnections [dbcdb79](https://github.com/nrkno/sofie-input-gateway/commit/dbcdb7953cb0eced261dbbdd48950f8b67732bb0)

### Features

- add building & signing executables [ec3bd56](https://github.com/nrkno/sofie-input-gateway/commit/ec3bd5669eec9c5e7758967299175bdb0c8a7bea)
- **(OSC)** Implement OSC Device [7474bea](https://github.com/nrkno/sofie-input-gateway/commit/7474bea38a257a6972ee4bb31dfcc9df76d12991)
- improve reliability [251a37f](https://github.com/nrkno/sofie-input-gateway/commit/251a37fd1bd7ceb144b7dfa3b4ceb9dbd0ca9124)
- **(InputManager)** improve Tally.PRESENT behavior [92780a7](https://github.com/nrkno/sofie-input-gateway/commit/92780a7b4661c5aeabcf595f935d820a1055a6f8)
- **(Skaarhoj)** rudimentary device support [a0fed30](https://github.com/nrkno/sofie-input-gateway/commit/a0fed30ce7ad26c670b47f168d31d79ab0e20a97)
- **(Stream Deck)** expand stream deck test case [ac2c718](https://github.com/nrkno/sofie-input-gateway/commit/ac2c718a3dfb32ef462ac65fa04bf023702f08ce)
- **(HTTP)** add automated tests for HTTP Device [6892ada](https://github.com/nrkno/sofie-input-gateway/commit/6892adaf30134813eaa3bcf5111a3cdf9a3bec2a)
- implement device refresh when device errors or can't be initialized on inputManager init. [18a3fec](https://github.com/nrkno/sofie-input-gateway/commit/18a3fec8b3d3164f8d33a9dc262807211f01096e)
- **(InputGateway)** configurable MIDI feedback [f1a6ea1](https://github.com/nrkno/sofie-input-gateway/commit/f1a6ea13ffc75eecbd5ac9e87cf3e6287db11751)
- **(InputGateway)** make configuration dynamic [f21188b](https://github.com/nrkno/sofie-input-gateway/commit/f21188b7aa2427119ae20596eb0932274236daaa)
- **(Feedback renderers)** change feedback rendering font size to be relative to screen size [497d915](https://github.com/nrkno/sofie-input-gateway/commit/497d915728ae736d67b327ce7358e35b11ddcda1)
- **(XKeys)** change device maching [039bb9d](https://github.com/nrkno/sofie-input-gateway/commit/039bb9d9e4b2cc977ecc1e463534d88c296e2a6c)
- **(MIDI)** add midi feedback [5b88bbc](https://github.com/nrkno/sofie-input-gateway/commit/5b88bbc595af8ffbbb75f59a5715b2c8ee2c073e)
- **(TextContext)** implement gradient support for background [137b611](https://github.com/nrkno/sofie-input-gateway/commit/137b611f981d7616092a205c795e53efb224b458)
- improve TextContext implementation [fc3e510](https://github.com/nrkno/sofie-input-gateway/commit/fc3e5109c800991da7a4e010f34272521d0f992f)
- split out bitmap feedback type renderers [c4df918](https://github.com/nrkno/sofie-input-gateway/commit/c4df918dbea8ceb3d7a1a4b4b9f076b2d1525b70)
- **(Streamdeck)** smarter feedback generation [1c1b67e](https://github.com/nrkno/sofie-input-gateway/commit/1c1b67ee5ec03d5a22a5478c60582d99bda361cb)
- **(StreamDeck)** implement adLib preview [edfbe17](https://github.com/nrkno/sofie-input-gateway/commit/edfbe17c795a85458e9c211fc37df4895ea666da)
- **(Streamdeck)** draw basic feedback [19f0b93](https://github.com/nrkno/sofie-input-gateway/commit/19f0b938b5bc0afcef50d2c779501c852266e265)
- working streamdeck trigger integration [1811ae3](https://github.com/nrkno/sofie-input-gateway/commit/1811ae3a76c4f1eedad6418079507d061111b8bd)
- **(StreamDeck)** add streamdeck device [a674de0](https://github.com/nrkno/sofie-input-gateway/commit/a674de04c5d65c2a7f66f8cacaf2ff12125ef33b)
- option to throttle fast events on the same triggerId [aefbff8](https://github.com/nrkno/sofie-input-gateway/commit/aefbff8842d266198102cde872d35196ddf15b28)
- working prototype [387f09e](https://github.com/nrkno/sofie-input-gateway/commit/387f09e1d5ffd44f1755e25e53d475dc6aa63ed6)
- first implementation WIP [01380c6](https://github.com/nrkno/sofie-input-gateway/commit/01380c6c6201a71e5b564a7e532c10e921b09aa8)
