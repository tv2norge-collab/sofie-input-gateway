# Sofie Input Gateway

This is the _Input Gateway_ of the [**Sofie** TV Automation System](https://github.com/nrkno/Sofie-TV-automation/), used to pipe user input into the [_Sofie Core_](https://github.com/nrkno/sofie-core).

### General Sofie System Info
* [Documentation](https://nrkno.github.io/sofie-core/)
* [Releases](https://nrkno.github.io/sofie-core/releases)
* [Contribution Guidelines](CONTRIBUTING.md)
* [License](LICENSE)

---

## Usage
```
// Development:
npm run start -host 127.0.0.1 -port 3000 -log "log.log"
// Production:
npm run start
```

**CLI Arguments:**

| Argument  | Description | Environment variable |
| ------------- | ------------- | --- |
| -host  | Hostname or IP of Core  | CORE_HOST  |
| -port  | Port of Core   |  CORE_PORT |
| -log  | Path to output log |  CORE_LOG |
| -id   | Device ID to use | DEVICE_ID |

## Installation for Developers

* yarn
* yarn build
* yarn test

### Development Dependencies:

* yarn
	https://yarnpkg.com

* jest
	yarn global add jest

---

_The NRK logo is a registered trademark of Norsk rikskringkasting AS. The license does not grant any right to use, in any way, any trademarks, service marks or logos of Norsk rikskringkasting AS._




