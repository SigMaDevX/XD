const herokuKeys = [
  "HRKU-AAKPmp63-EAct3qWY4Hwz4QH3SjuKWQOawLsQbCCGoDA_____w2JBt9xtt8V",
  "HRKU-AAiM2iM1fj51HV_suyoRmgZNL77YyDSgefWKJUXgCPuw_____wHp6U4dbjAs",
  "HRKU-AAKPmp63-EAct3qWY4Hwz4QH3SjuKWQOawLsQbCCGoDA_____w2JBt9xtt8V"
];

/**
 * Random Heroku API key select kare
 */
function getRandomHerokuKey() {
  return herokuKeys[Math.floor(Math.random() * herokuKeys.length)];
}

module.exports = { getRandomHerokuKey };
