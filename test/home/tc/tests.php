<?php

putenv("WEBDRIVER_FIXEFOX_DRIVER=/usr/local/bin/geckodriver");

require_once(__DIR__ . '/vendor/autoload.php');
use Facebook\WebDriver\Firefox\FirefoxDriver;
use Facebook\WebDriver\Firefox\FirefoxOptions;
use Facebook\WebDriver\Firefox\FirefoxProfile;
use Facebook\WebDriver\WebDriverWait;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;

// Modifiable constants
$delay=10;  // 10  seconds
$retry=50;  // 50 ms
$host = "https://10.0.2.15:5000";
$user="tc";
$pass="dSaO2021cTf";
define("_LEN", 50);

// Non modifable constants
define("_red", "\033[1;31m");
define("_green", "\033[1;32m");
define("_yellow", "\033[1;33m");
define("_normal", "\033[1;39m");

function msg($msg = "Test") {
  if (strlen($msg) > _LEN)
    $msg = substr($msg, 0, _LEN) . " .";
  else
    $msg = $msg .  " " . str_repeat(".", _LEN - strlen($msg) + 1);
  echo $msg . " ";
}

function pass() {
  echo _green . "[PASS]" . _normal . PHP_EOL; 
}

function warn() {
  echo _yellow . "[WARN]" . _normal . PHP_EOL;
}

function fail() {
  echo _red. "[FAIL]" . _normal . PHP_EOL;
}

function fatal($msg, $err = 1) {
  echo _red . "[FATAL]" . _normal . PHP_EOL;
  $GLOBALS["driver"]->quit();
  exit($err);
}

// Setup local firefox instance
msg("Setting up firefox instance");
$firefoxOptions = new FirefoxOptions();
$firefoxOptions->addArguments(["-headless"]);

$firefoxProfile = new FirefoxProfile();
$firefoxProfile->setPreference("browser.download.dir", "/tmp");
$firefoxProfile->setPreference("browser.download.panel.shown", false);

$caps = Facebook\WebDriver\Remote\DesiredCapabilities::firefox();
$caps->setCapability(FirefoxOptions::CAPABILITY, $firefoxOptions);
$caps->setCapability(FirefoxDriver::PROFILE, $firefoxProfile);
$caps->setCapability("acceptInsecureCerts", true);
$driver = FirefoxDriver::start($caps);
$wait = new WebDriverWait($driver, $delay);
pass();

// Get login page
msg("Navigating to /login.html");
$driver->get($host . "/login.html");
$driver->wait($delay, $retry)->until(WebDriverExpectedCondition::titleIs("DSAS Login"));
if ($driver->getTitle() === "DSAS Login")
  pass();
else
  fatal(1);

// Enter username
msg("Testing Login");
$driver->findElement(WebDriverBy::id("inp_user"))->sendKeys($user);
$driver->findElement(WebDriverBy::id("inp_pass"))->sendKeys($pass);
$driver->findElement(WebDriverBy::className("btn"))->click();

// Check if on main page
$driver->wait($delay, $retry)->until(WebDriverExpectedCondition::titleIs("Main"));
if ($driver->getTitle() === "Main")
  pass();
else
  fatal();

// Check Status section of main page
$driver->wait($delay, $retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("col-6")));
msg("Checking legal values in status bar");
// Fail if status bar contains NaN values
if (str_contains($driver->findElement(WebDriverBy::id("StatusBar"))->getDomProperty("innerHTML"), "NaN"))
  fail();
else
  pass();

// FIXME test log search function. Need dummy logs

// FIXME test "only errors" button. Need dummy logs

// Navigate to /web.html via navbar 
msg("Navigating to /web.html via navbar");
$driver->findElements(WebDriverBy::className("nav-item"))[0]->click();
try {
  $driver->findElement(WebDriverBy::xpath("//a[@href='web.html']"))->click();
} catch (RunTimeException $e) {
  fatal(1);
}

// Check if on  web.html
$driver->wait($delay, $retry)->until(WebDriverExpectedCondition::titleIs("Web"));
if ($driver->getTitle() === "Web")
  pass();
else
  fail();

// Test existence of PEM and CSR on page
msg("Testing existence of CSR");
// FIXME why does the underscore here have to be a character encoding ?
if (str_contains($driver->findElement(WebDriverBy::id("csr" . chr(95) . "body"))->getDomProperty("innerHTML"), "-----BEGIN CERTIFICATE REQUEST-----"))
  pass();
else
  fail();
msg("Testing existence of PEM");
if (str_contains($driver->findElement(WebDriverBy::id("pem_body"))->getDomProperty("innerHTML"), "-----BEGIN CERTIFICATE-----"))
  pass();
else
  fail();

// Download the PEM
msg("Try downloading PEM");
try {
  $driver->findElement(WebDriverBy::id("getpem"))->click();
  pass();
} catch (RuntimException $e) {
  fail();
}



// FIXME Test change in certificate

// Quit firefox instance
$driver->quit();

?>