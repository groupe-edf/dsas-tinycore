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
define("_user", "tc");
define("_pass", "dSaO2021cTf");
define("_delay", 5);  // 5 seconds
define("_retry", 50);  // 50 ms
define("_LEN", 60);
define("_adminport", "5000");
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

function test(string $_msg, callable $_fn, bool $_fatal = false) {
  try {
    msg($_msg);
    if ($_fn())
      pass();
    else if ($_fatal) {
      fail();
      throw new RunTimeException("The previous error was fatal");
    } else
      fail();
  } catch (Throwable $e) {
    fail();
    echo $e->getMessage() . PHP_EOL;
    if ($_fatal) 
      throw $e;
  }
}

function hostip() {
  // Get IP addresss of the principal interface
  if ($handle = opendir("/sys/class/net")) {
    while (false != ($entry = readdir($handle))) {
      switch ($entry) {
        case ".":
        case "..":
        case "lo":
        case (preg_match("/dummy/", $entry) ? true : false):
        case (preg_match("/tunl/", $entry) ? true : false):
          break;
        default:
          $pattern = "/inet addr:(\d+\.\d+\.\d+\.\d+)/";
          exec("/sbin/ifconfig $entry", $output, $retval);
          if ($retval != 0)
            return false;
          preg_match($pattern, implode(" ", $output), $matches);
          if (count($matches) < 2)
            return false;
          return $matches[1];
      }
    }
  }
  return ""; 
}

// Main block of test code
try {
  // Setup local firefox instance
  test("Setting up firefox instance", function () {
      $firefoxOptions = new FirefoxOptions();
      $firefoxOptions->addArguments(["-headless"]);

      $firefoxProfile = new FirefoxProfile();
      $firefoxProfile->setPreference("browser.download.folderList", 2);
      $firefoxProfile->setPreference("browser.download.manager.showWhenStarting", false);
      $firefoxProfile->setPreference("browser.helperApps.alwaysAsk.force", false);
      $firefoxProfile->setPreference("browser.helperApps.neverAsk.saveToDisk", "text/plain");
      $firefoxProfile->setPreference("browser.helperApps.neverAsk.openFile", "text/plain");
      $firefoxProfile->setPreference("browser.download.dir", "/tmp");
      $firefoxProfile->setPreference("browser.download.manager.focusWhenStarting", false);
      $firefoxProfile->setPreference("browser.download.manager.useWindow", false);
      $firefoxProfile->setPreference("browser.download.manager.showAlertOnComplete", false);
      $firefoxProfile->setPreference("browser.download.manager.closeWhenDone", false);
      //$firefoxProfile->setPreference("browser.download.panel.shown", false);

      $caps = Facebook\WebDriver\Remote\DesiredCapabilities::firefox();
      $caps->setCapability(FirefoxOptions::CAPABILITY, $firefoxOptions);
      $caps->setCapability(FirefoxDriver::PROFILE, $firefoxProfile);
      $caps->setCapability("acceptInsecureCerts", true);
      $GLOBALS["driver"] = FirefoxDriver::start($caps);
      return true;
    }, true);

  // Get login page
  test("Navigating to /login.html", function () {
      $GLOBALS["driver"]->get("https://" . hostip() .":" . _adminport . "/login.html");
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("DSAS Login"));
      return ($GLOBALS["driver"]->getTitle() === "DSAS Login");
    }, true);

  // FIXME Check CapsLock message is correctly displayed

  // Enter no values and check error condition
  test("Empty username and password", function () {
      // Clear feedback on page before continuing
      $GLOBALS["driver"]->executeScript("for (feed of document.getElementsByClassName(\"form-control\")) feed.setAttribute(\"class\", \"form-control\");");
      $GLOBALS["driver"]->findElement(WebDriverBy::className("btn"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("is-invalid")));
      return (str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id("inp_user"))->getAttribute("class"), "is-invalid"));
    });

  // Enter username and no password and check error condition
  test("Empty password", function () {
      $GLOBALS["driver"]->executeScript("for (feed of document.getElementsByClassName(\"form-control\")) feed.setAttribute(\"class\", \"form-control\");");
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_user"))->sendKeys(_user);
      $GLOBALS["driver"]->findElement(WebDriverBy::className("btn"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("is-invalid")));
      return (str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id("inp_pass"))->getAttribute("class"), "is-invalid"));
    });

  // Enter bad username and password and check error condition. Careful of the delay
  test("Bad username and password", function () {
      $GLOBALS["driver"]->executeScript("for (feed of document.getElementsByClassName(\"form-control\")) feed.setAttribute(\"class\", \"form-control\");");
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_user"))->clear()->sendKeys("BadUser");
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_pass"))->clear()->sendKeys("BadPassword");
      $GLOBALS["driver"]->findElement(WebDriverBy::className("btn"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("is-invalid")));
      return (str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id("inp_pass"))->getAttribute("class"), "is-invalid"));
    });

  // Enter good username and password
  test("Testing Login", function() {
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_user"))->clear()->sendKeys(_user);
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_pass"))->clear()->sendKeys(_pass);
      $GLOBALS["driver"]->findElement(WebDriverBy::className("btn"))->click();
      // Wait to be on main page
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Main"));
      return ($GLOBALS["driver"]->getTitle() === "Main");
    }, true);

  // Check Status section of main page has real values
  test("Checking legal values in status bar", function () {
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("col-6")));
      // Fail if status bar contains NaN values
      return  (! str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id("StatusBar"))->getDomProperty("innerHTML"), "NaN"));
    });

  // FIXME test status progress bars 

  // FIXME test log search function. Need dummy logs

  // FIXME test "only errors" button. Search for "Ok" at start of log line and 
  // test if a line is highlighted. Need dummy logs

  // Navigate to /web.html via navbar 
  test("Navigating to /web.html via navbar", function () {
      $GLOBALS["driver"]->findElements(WebDriverBy::className("nav-item"))[0]->click();
      $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='web.html']"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Web"));
      return ($GLOBALS["driver"]->getTitle() === "Web");
    }, true);

  // Toggle visbility of details on page
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::xpath("//a[@href='#csr']")));
  $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#csr']"))->click();
  $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#cert']"))->click();

  // Test existence of PEM and CSR on page
  test("Testing existence of CSR", function () {
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("csr_body")));
      return (str_starts_with($GLOBALS["driver"]->findElement(WebDriverBy::id("csr_body"))->getDomProperty("innerHTML"), "-----BEGIN CERTIFICATE REQUEST-----"));
    });
  test("Testing existence of PEM", function () {
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("pem_body")));
      return (str_starts_with($GLOBALS["driver"]->findElement(WebDriverBy::id("pem_body"))->getDomProperty("innerHTML"), "-----BEGIN CERTIFICATE-----"));
    });

  // Download the PEM and CSR. Would be better to click on id="getpem" 
  // but couldn't get it to work properly
  test("Try downloading CSR", function () {
      $_uri = $GLOBALS["driver"]->findElement(WebDriverBy::id("getcsr"))->getAttribute("href");
      $_str = $GLOBALS["driver"]->executeScript("async function asyncfetch(uri) { const reponse = await fetch (uri); return reponse.text();}; return asyncfetch(\"" . $_uri ."\");");
      return (str_starts_with($_str, "-----BEGIN CERTIFICATE REQUEST-----"));
    });
  test("Try downloading PEM", function () {
      $_uri = $GLOBALS["driver"]->findElement(WebDriverBy::id("getpem"))->getAttribute("href");
      $_str = $GLOBALS["driver"]->executeScript("async function asyncfetch(uri) { const reponse = await fetch (uri); return reponse.text();}; return asyncfetch(\"" . $_uri ."\");");
      return (str_starts_with($_str, "-----BEGIN CERTIFICATE-----"));
    });

  // FIXME Test upload of CRT. Difficult to do without CA

  // FIXME Test change in certificate

  // Navigate to /net.html via navbar 
  test("Navigating to /net.html via navbar", function () {
      $GLOBALS["driver"]->findElements(WebDriverBy::className("nav-item"))[0]->click();
      $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='net.html']"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Net"));
      return ($GLOBALS["driver"]->getTitle() === "Net");
    }, true);

  // Toggle visbility of details on page
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::xpath("//a[@href='#iface1']")));
  $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#iface0']"))->click();
  $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#iface1']"))->click();

  // FIXME Save state of the upper network

  // FIXME Try setting and rereading the network details of the Upper machine
  
  // FIXME Try applying and seeing if network changed on upper machine

  // FIXME Restore state of upper network and apply

  // Navigate to /service.html via navbar 
  test("Navigating to /service.html via navbar", function () {
      $GLOBALS["driver"]->findElements(WebDriverBy::className("nav-item"))[0]->click();
      $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='service.html']"))->click();
      $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Service"));
      return ($GLOBALS["driver"]->getTitle() === "Service");
    }, true);

  // FIXME Try activating SSH
  
  // FIXME Try setting bad SSH IP addresses for admin

  // FIXME Try setting good SSH IP addresses for admin
 
  // FIXME Try setting complex SSH IP addresses for admin (10.0.2.0/24,!10.0.2.100)

  // FIXME Try setting bad SSH IP addresses for haut 

  // FIXME Try setting good SSH IP addresses for haut
 
  // FIXME Try setting complex SSH IP addresses for haut (10.0.2.0/24,!10.0.2.100)

  // FIXME Try setting bad SSH IP addresses for bas 

  // FIXME Try setting good SSH IP addresses for bas
 
  // FIXME Try setting complex SSH IP addresses for bas (10.0.2.0/24,!10.0.2.100)

  // FIXME Try applying config and seeing if LISTEN of SSH ports 

  // FIXME deactivate SSH 

  // FIXME SNMP

  // FIXME SYSLOG

  // FIXME Test activating and changing ntp hosts (multiple IPs)

  // FIXME deactivate NTP

  // FIXME Try activating and applying antivirus and see if
  // clamdscan is running. Needs CVD files pre-installed

  // FIXME deactivate clamav 

  // FIXME activate repository and check is host on port 443 exists

  // FIXME deactivate repository
 

} catch (Exception $e) {
  // Catch other errors here so that firefox is shut down cleanly
  echo $e->getMessage();
} finally {
  // Quit firefox instance
  $driver->quit();
}

?>