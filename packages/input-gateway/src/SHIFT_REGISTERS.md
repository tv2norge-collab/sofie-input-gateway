Shift Registers
===

In order to support a "generic" way of doing multiple "layers" of controls on a single control surface (or a group of them), the concept of "modifier keys" had to be generalized. This has been done by coming up with the concept of _Shift Registers_.

A Shift Register is a numbered integer variable that is global to a given instance of Input Gateway. Actions mounted to the Triggers of various Input Devices can then modify these Shift Registers using simple operations: Add (`+`), Subtract (`-`) and Set (`=`) and a single operand value. Since the Add and Subtract operations do not have any stop conditions, in order for their behavior to be more predictable, additional `min` and `max` properties to clamp the resulting Shift Register to a range after the operation is done.

The state of all of the Shift Registers in an Input Gateway is prepended to the "triggerId" string of all emitted triggers using the following algorithm:

* If all Shift Registers are set to 0 (their initial value), the prefix is an empty string. _This allows backwards compatibility if one is not using Shift Registers at all._
* If a Shift Register is set to a value other than 0, iterate through the Shift Registers and concatenate their values, joined with a `:` character, until the last non-zero Shift Register is found. An example Shift Registers state prefix will look look something like this: `[1:2:0:1]`

Since this "Shift Registers" prefix is effectively changing the triggers themselves, this also affects the feedback displayed by the Input Devices.

For example: by adding the "Change Shift Register" actions to various _button down_ and _button up_ triggers, one can choose to build various interaction models:

* Shift + Button interactions
* Latching Shift buttons
* Cascading menus
* Folders
* Or even number inputs

In order to get the desired interaction model, it may be neccessary to add the same action to multiple triggers (the same physical trigger with various Shift Register prefixes) or to split actions on prefixed and unprefixed triggers.