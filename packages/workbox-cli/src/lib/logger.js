/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/

const chalk = require('chalk');

module.exports = {
  debug: (...args) => console.log(chalk.gray(...args)),
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(chalk.yellow(...args)),
  error: (...args) => console.error(chalk.red.bold(...args)),
};
