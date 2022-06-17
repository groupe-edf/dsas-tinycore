<?php

putenv("WEBDRIVER_FIXEFOX_DRIVER=/usr/local/bin/geckodriver");
require_once(__DIR__ . '/vendor/autoload.php');
use Facebook\WebDriver\Firefox\FirefoxDriver;
use Facebook\WebDriver\Firefox\FirefoxOptions;
use Facebook\WebDriver\Firefox\FirefoxProfile;
use Facebook\WebDriver\Exception\TimeoutException;
use Facebook\WebDriver\Interactions\WebDriverActions;
use Facebook\WebDriver\WebDriverWait;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverSelect;
use Facebook\WebDriver\WebDriverExpectedCondition;

// Modifiable constants
$what = "serv" ; // all, login, status, web, net, serv, cert, task, user, backup 
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
    else if ($_fatal)
      throw new RuntimeException("The previous error was fatal");
    else
      fail();
  } catch (Throwable $e) {
    fail();
    if ($_fatal) 
      throw $e;
    else
      echo $e->getMessage() . PHP_EOL;
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

function readline($prompt = null) {
  if ($prompt)
    echo $prompt;
  exec("stty -echo");
  $line = rtrim(fgets(STDIN, 1024));
  exec("stty echo");
  echo PHP_EOL;
  return $line;
}

// A function for all of the failing tests including feedback
function feedfn($msg, $fld, $value) {
  $GLOBALS["args"] = [];
  $GLOBALS["args"][] = $fld;
  $GLOBALS["args"][] = $value;
  test($msg, function () {
      $fld = $GLOBALS["args"][0];
      $value = $GLOBALS["args"][1];
      $GLOBALS["driver"]->executeScript("for (feed of document.getElementsByClassName(\"form-control\")) feed.setAttribute(\"class\", \"form-control\");");
      $GLOBALS["driver"]->findElement(WebDriverBy::id($fld))->clear()->sendKeys($value);
      save(false);
      try { 
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::className("is-invalid")));
      } catch (TimeoutException $e) {
        throw new RuntimeException("Undetected bad feedback value");
      }
      return (str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id($fld))->getAttribute("class"), "is-invalid"));
    }); 
}

// Apply and clear modals
function apply() {
  foreach ($GLOBALS["driver"]->findElements(WebDriverBy::className("btn")) as $el) {
    if (str_contains($el->getAttribute("class"), "nav-link")) {
      $el->click();  // Click on Apply button
      break;
    }
  }
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("okDSAS")));
  $GLOBALS["driver"]->findElement(WebDriverBy::id("okDSAS"))->click(); // Click Ok to confirm
  // Extra long delay here during apply
  $GLOBALS["driver"]->wait(4 * _delay, _retry)->until(WebDriverExpectedCondition::invisibilityOfElementLocated(WebDriverBy::id("cancelDSAS")));
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::elementToBeClickable(WebDriverBy::id("okDSAS")));
  // FIXME Even though okDSAS is clickable, bootstrap won't take the click
  // into account while the "fade" animation isn't finished. Need to wait a bit
  usleep(500000);
  $GLOBALS["driver"]->findElement(WebDriverBy::id("okDSAS"))->click(); // Click Ok to confirm
  // Wait for modal to clear
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::invisibilityOfElementLocated(WebDriverBy::className("modal-backdrop")));
}

// Hit save button on page and clear any modals
function save($modal = true) {
  // Have to be careful not to click the Apply button
  foreach ($GLOBALS["driver"]->findElements(WebDriverBy::className("btn")) as $el) {
    if (str_contains($el->getAttribute("class"), "nav-link"))
      continue;
    if ($el->getTagName() !== "input")
      continue;
    $el->click();
    break;
  }
  if ($modal) {
    $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::elementToBeClickable(WebDriverBy::id("okDSAS")));
    usleep(500000);
    $GLOBALS["driver"]->findElement(WebDriverBy::id("okDSAS"))->click(); // Click Ok to confirm
    $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::invisibilityOfElementLocated(WebDriverBy::className("modal-backdrop")));
  }
}

// A function for succeeding test with modal ok button
function modalfn($msg, $fld, $value, $modal = true) {
  $GLOBALS["args"] = [];
  $GLOBALS["args"][] = $fld;
  $GLOBALS["args"][] = $value;
  $GLOBALS["args"][] = $modal;
  test($msg, function () {
      $fld = $GLOBALS["args"][0];
      $value = $GLOBALS["args"][1];
      $GLOBALS["driver"]->executeScript("for (feed of document.getElementsByClassName(\"form-control\")) feed.setAttribute(\"class\", \"form-control\");");
      $GLOBALS["driver"]->findElement(WebDriverBy::id($fld))->clear()->sendKeys($value);
      try { 
        save($GLOBALS["args"][2]);
      } catch (TimeoutException $e) {
        throw new RuntimeException("Error setting value");
      }
      return (str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id($fld))->getAttribute("value"), $value));
    }); 
}

// Save XML configure file for restoration at the end
copy("/var/dsas/dsas_conf.xml", "/var/dsas/dsas_conf.xml.test"); 

// Read password from console
$password = readline("Enter password of user '" . _user . "' [Return for default]: ");
if (empty($password))
  $password = _pass;

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

  if ($what === "all" || $what === "login") {

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
  }

  // Enter good username and password
  test("Testing Login", function() {
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_user"))->clear()->sendKeys(_user);
      $GLOBALS["driver"]->findElement(WebDriverBy::id("inp_pass"))->clear()->sendKeys($GLOBALS["password"]);
      $GLOBALS["driver"]->findElement(WebDriverBy::className("btn"))->click();
      // Wait to be on main page
      try { 
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Main"));
      } catch (TimeoutException $e) {
        throw new RuntimeException("Bad Password");
      }
      return true;
    }, true);

  // Wait for page to be fully displayed
  $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("logpane")));

  if ($what === "all" || $what === "status") {
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

  }

  if ($what === "all" || $what === "web") {
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
  }

  if ($what === "all" || $what === "net") {
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

    // Save state of the upper network
    test("Saving network state of upper machine", function () {
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("iface_dhcp1")));
        $GLOBALS["net1"]["dhcp"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->isSelected();
        $GLOBALS["net1"]["cidr"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_cidr1"))->getAttribute("value");
        $GLOBALS["net1"]["gateway"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_gateway1"))->getAttribute("value");
        $GLOBALS["net1"]["domain"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->getAttribute("value");
        $GLOBALS["net1"]["nameserver"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_nameserver1"))->getAttribute("value");
        return true;
      }, true);

    // Try setting and rereading the network details of the Upper machine
    test("Setting good static IP address configuration", function () {
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->click();
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_cidr1"))->clear()->sendKeys("192.168.0.1/24");
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_gateway1"))->clear()->sendKeys("192.168.0.254");
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->clear()->sendKeys("example.com");
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_nameserver1"))->clear()->sendKeys("8.8.8.8" . PHP_EOL . "1.1.1.1");
        save(false);
        // Refresh page and reread values
        $GLOBALS["driver"]->navigate()->refresh();
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::xpath("//a[@href='#iface1']")));
        $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#iface0']"))->click();
        $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='#iface1']"))->click();
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("iface_dhcp1")));
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->isSelected() ||
            ("192.168.0.1/24" !== $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_cidr1"))->getAttribute("value")) ||
            ("192.168.0.254" !== $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_gateway1"))->getAttribute("value")) ||
            ("example.com" !== $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->getAttribute("value")) ||
            ! str_contains($GLOBALS["driver"]->findElement(WebDriverBy::id("iface_nameserver1"))->getAttribute("value"), "1.1.1.1"))
          throw new RuntimeException("Could not set upper network values");
        return true;
      });

    // Try setting bad values to the network fields
    feedfn("Setting bad CIDR address 1", "iface_cidr1", "270.0.1.1/24");
    feedfn("Setting bad CIDR address 2", "iface_cidr1", "192.168.0.1");
    feedfn("Setting bad CIDR address 3", "iface_cidr1", "test.example.com");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_cidr1"))->clear()->sendKeys("192.168.0.1");
    feedfn("Setting bad gateway address 1", "iface_gateway1", "270.0.0.1");
    feedfn("Setting bad gateway address 2", "iface_gateway1", "192.168.0.254/24");
    feedfn("Setting bad gateway address 3", "iface_gateway1", "test.example.com");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_gateway1"))->clear()->sendKeys("192.168.0.254");
    feedfn("Setting bad DNS domain 1", "iface_dns_domain1", "-example.com");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->clear()->sendKeys("example.com");
    feedfn("Setting bad nameserver 1", "iface_nameserver1", "example.com");
    feedfn("Setting bad nameserver 2", "iface_nameserver1", "270.0.1.1");
    feedfn("Setting bad nameserver 3", "iface_nameserver1", "8.8.8.0/24");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->clear()->sendKeys("8.8.8.8" . PHP_EOL . "1.1.1.1");
 
    // Try applying and seeing if network changed on upper machine
    test("Applying network configuration", function () {
        apply();
        // Ok the configuration has been correctly applied. Now look 
        // the real configuration of the network devices. Look for
        // network interface that is alphabetically last 
        $iface = "zzz";
        exec("ssh tc@haut ls /sys/class/net", $ifaces);
        foreach ($ifaces as $entry) {
          switch ($entry) {
            case ".":
            case "..":
            case "lo":
            case (preg_match("/dummy/", $entry) ? true : false):
            case (preg_match("/tunl/", $entry) ? true : false):
              break;
            default:
              if (strcmp($entry, $iface) < 0)
                $iface = $entry;
              break;
          }
        }
        if ($iface === "zzz")
          throw new RuntimeException("Can not find interface");
        exec("ssh tc@haut ifconfig " . $iface, $data);
        preg_match("/^inet addr:([0-9.]+).*Bcast:([0-9.]+).*Mask:([0-9.]+).*$/",
            trim($data[1]), $regex);
        $cidr = 32 - log((ip2long($regex[3]) ^ ip2long("255.255.255.255")) + 1, 2);  
        if ( "192.168.0.1/24" != $regex[1] . "/" . $cidr)
          throw new RuntimeException("Can not set IP address et mask");
        $data = [];
        exec("ssh tc@haut route", $data);
        preg_match("/^default\\s+([0-9.]+)/", $data[2], $regex);
        if ("192.168.0.254" != $regex[1])
          throw new RuntimeException("Can not IP gateway");
        $data = [];
        exec("ssh tc@haut cat /etc/resolv.conf", $data);
        if ("search example.com" != $data[0] ||
            "nameserver 8.8.8.8" != $data[1] ||
            "nameserver 1.1.1.1" != $data[2])
          throw new RuntimeException("Can not configure the DNS");
        return true;
      }); 

    // Restore state of upper network and apply
    test("Restoring original network configuration", function () {
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("iface_dhcp1")));
        if ($GLOBALS["net1"]["dhcp"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dhcp1"))->click();
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_cidr1"))->clear()->sendKeys($GLOBALS["net1"]["cidr"]);
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_gateway1"))->clear()->sendKeys($GLOBALS["net1"]["gateway"]);
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_dns_domain1"))->clear()->sendKeys($GLOBALS["net1"]["domain"]);
        $GLOBALS["driver"]->findElement(WebDriverBy::id("iface_nameserver1"))->clear()->sendKeys($GLOBALS["net1"]["nameserver"]);
        save(false);
        apply();
        return true;
      }, true);

    // FIXME should I repeat the above for iface0 ? Seems to be overkill
  }

  if ($what === "all" || $what === "serv") {
    // Navigate to /service.html via navbar 
    test("Navigating to /service.html via navbar", function () {
        $GLOBALS["driver"]->findElements(WebDriverBy::className("nav-item"))[0]->click();
        $GLOBALS["driver"]->findElement(WebDriverBy::xpath("//a[@href='service.html']"))->click();
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::titleIs("Service"));
        return ($GLOBALS["driver"]->getTitle() === "Service");
      }, true);

    // Save state of the services page
    test("Saving the state of the services", function () {
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("repo")));
        $GLOBALS["serv"]["ssh"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->isSelected();
        $GLOBALS["serv"]["user_tc"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("user_tc"))->getAttribute("value");
        $GLOBALS["serv"]["user_bas"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("user_bas"))->getAttribute("value");
        $GLOBALS["serv"]["user_haut"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("user_haut"))->getAttribute("value");
        $GLOBALS["serv"]["snmp"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->isSelected();
        $GLOBALS["serv"]["snmp_user"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_user"))->getAttribute("value");
        $GLOBALS["serv"]["snmp_pass"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_pass"))->getAttribute("value");
        $encrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_encrypt")));
        foreach ($encrypt->getOptions() as $el) {
          if ($el->isSelected()) {
            $GLOBALS["serv"]["snmp_encrypt"] = $el->getAttribute("value");
            break;
          }
        } 
        $privencrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_privencrypt")));
        foreach ($privencrypt->getOptions() as $el) {
          if ($el->isSelected()) {
            $GLOBALS["serv"]["snmp_privencrypt"] = $el->getAttribute("value");
            break;
          }
        } 
        $GLOBALS["serv"]["snmp_passpriv"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_passpriv"))->getAttribute("value");
        $GLOBALS["serv"]["syslog"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("syslog"))->isSelected();
        $GLOBALS["serv"]["syslog_server"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("syslog_server"))->getAttribute("value");
        $GLOBALS["serv"]["ntp"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->isSelected();
        $GLOBALS["serv"]["ntp_pool"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp_pool"))->getAttribute("value");
        $GLOBALS["serv"]["antivirus"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus"))->isSelected();
        $GLOBALS["serv"]["antivirus_uri"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus_uri"))->getAttribute("value");
        $GLOBALS["serv"]["repo"] = $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->isSelected();
        return true;
      }, true);

    // Activate SSH
    if (! $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->isSelected())
      $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->click();

    // Try setting bad SSH IP addresses for admin
    feedfn("Setting bad admin address", "user_tc", "270.0.1.1/24");
    // Try setting good SSH IP addresses for admin
    modalfn("Setting good admin address", "user_tc", "127.0.0.1/32");
    // Try setting complex SSH IP addresses for admin (10.0.2.0/24,!10.0.2.100)
    modalfn("Setting complex admin address", "user_tc", "0.0.0.0/0,!127.0.0.1");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("user_tc"))->clear()->sendKeys("0.0.0.0/0");
    feedfn("Setting bad upper user address", "user_haut", "270.0.1.1/24");
    modalfn("Setting good upper user address", "user_haut", "127.0.0.1/32");
    modalfn("Setting complex upper user address", "user_haut", "0.0.0.0/0,!127.0.0.1");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("user_haut"))->clear();
    feedfn("Setting bad lower user address", "user_bas", "270.0.1.1/24");
    modalfn("Setting good lower user address", "user_bas", "127.0.0.1/32");
    modalfn("Setting complex lower user address", "user_bas", "0.0.0.0/0,!127.0.0.1");
    $GLOBALS["driver"]->findElement(WebDriverBy::id("user_bas"))->clear();

    // Get principal interface, IP and mask of lower machine
    $iface = "zzz";
    exec("ls /sys/class/net", $ifaces);
    foreach ($ifaces as $entry) {
      switch ($entry) {
        case ".":
        case "..":
        case "lo":
        case (preg_match("/dummy/", $entry) ? true : false):
        case (preg_match("/tunl/", $entry) ? true : false):
          break;
        default:
          if (strcmp($entry, $iface) < 0)
            $iface = $entry;
          break;
      }
    }
    if ($iface === "zzz")
      throw new RuntimeException("Can not find interface");
    exec("ifconfig " . $iface, $data);
    preg_match("/^inet addr:([0-9.]+).*Bcast:([0-9.]+).*Mask:([0-9.]+).*$/",
       trim($data[1]), $regex);
    $cidr = 32 - log((ip2long($regex[3]) ^ ip2long("255.255.255.255")) + 1, 2);  
    $ip = $regex[1];

    // Try applying config and seeing if listening on right SSH addresses and users 
    test("Applying ssh configuration", function () {
        apply();
        exec("netstat -at 2> /dev/null", $data);
        foreach ($data as $d) {
          preg_match("/^tcp.*\s([0-9.]+):[22|ssh].*\s([0-9.]+):.*LISTEN\s*$/",
             trim($d), $regex);
          if (empty($regex))
            continue;
          break;
        }
        if (empty($regex))
          throw new RuntimeException("Can not start ssh server");
        if ($GLOBALS["ip"] != $regex[1])
          throw new RuntimeException("Server ssh listening on wrong interface");
        $f = explode(PHP_EOL, file_get_contents("/usr/local/etc/ssh/sshd_config"));
        $isok = false;
        foreach ($f as $_f) {
          preg_match("/^ListenAddress\s+([0-9.]+).*$/", trim($_f), $regex);
          if (! empty($regex) && $regex[1] == $GLOBALS["ip"]) {
            $isok = true;
            break;
          }
        }
        if (! $isok) {
          if (empty($regex))
            throw new RuntimeException("Could not detect ssh server listening address");
          else
            throw new RuntimeException("Server ssh listening on wrong address : " . $regex[1]);
        }
        $isok = false;
        foreach ($f as $_f) {
          preg_match("/^Match User ([a-z0-9-]+)\s+Address\s+([0-9.]+)\/([0-9]+)\s*$/", trim($_f), $regex);
          if (! empty($regex)) {
            if ( $regex[1] == "tc" && $regex[2] == "0.0.0.0" && $regex[3] == "0")
              $isok = true;
            break;
          }
        }
        if (! $isok) {
          if (empty($regex))
            throw new RuntimeException("Can not find ssh server users and address");
          else
            throw new RuntimeException("Server ssh listening incorrect users '" . $regex[1] . "' or address '" . $regex[2] . "/" . $regex[3] . "'");
        }
        return true;
      }, true);

    // Deactivate SSH
    if ($GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->isSelected())
      $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->click();

    // Test activation of SNMP
    test("Activation of SNMPv3", function () {
        if (! $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->click();

        $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_user"))->clear()->sendKeys("TestUser");
        $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_pass"))->clear()->sendKeys("P@ssw0rd!");
        $encrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_encrypt")));
        $encrypt->selectByValue("SHA");
        $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_passpriv"))->clear()->sendKeys("P@ssw0rd!");
        $privencrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_privencrypt")));
        $privencrypt->selectByValue("AES");
        save();
        apply();
        exec("snmpwalk -v3 -l authPriv -u TestUser -a SHA -A P@ssw0rd! -x AES -X P@ssw0rd! 10.0.2.15 1.3.6.1.4.1.16845.100.100.2.0", $data, $retval);
        return ($retval == 0);
      });

    // Ensure that snmp is properly deactivated
    test("Deactivation of SNMPv3", function () {
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->click();
        save();
        apply();
        exec("pgrep snmpd", $data, $retval);
        return ($retval != 0);
      }); 

    // FIXME SYSLOG

    // Test activating and changing ntp hosts (multiple IPs)
    test("Activation of NTP", function () {
        if (! $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->click();

        $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp_pool"))->clear()->sendKeys("ntp1.example.com" . PHP_EOL . "ntp2.example.com");
        save();
        apply();
        exec("pgrep ntpd", $data, $retval);
        if ($retval == 0) {
          $cmdline = file_get_contents("/proc/" . $data[0] . "/cmdline");
          if (! preg_match("/.*ntp1.example.com.*ntp2.example.com.*$/", $cmdline))
            throw new RuntimeException("Incorrect ntp commandline");
        } else
          throw new RuntimeException("Can not start ntpd");
        return true;
      });
        
    // iEnsure that deactivating ntp works correctly
    test("Deactivation of NTP", function () {
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->click();
        save();
        apply();
        exec("pgrep ntpd", $data, $retval);
        return ($retval != 0);
      });
        
    // FIXME Try activating and applying antivirus and see if
    // clamdscan is running. Needs CVD files pre-installed

    // FIXME deactivate clamav 

    // Activate repository and check is host on port 443 exists
    test("Activation of HTTPS repository", function () {
        if (! $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->click();
        save();
        apply();
        // Check if repo is running 
        exec("pgrep -f 'repo.conf'", $data, $retval); 
        return ($retval == 0);
      }, true);

    // Deactivate repository and check no host on port 443 exists
    test("Deactivation of HTTPS repository", function () {
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->click();
        save();
        apply();
        // Check if repo is running 
        exec("pgrep -f 'repo.conf'", $data, $retval); 
        return ($retval != 0);
      }, true);

    // Retore service configuration
    test("Restoring original services configuration", function () {
        $GLOBALS["driver"]->wait(_delay, _retry)->until(WebDriverExpectedCondition::visibilityOfElementLocated(WebDriverBy::id("repo")));
        if ($GLOBALS["serv"]["ssh"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->click();
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("ssh"))->isSelected()) {
          $GLOBALS["driver"]->findElement(WebDriverBy::id("user_tc"))->clear()->sendKeys($GLOBALS["serv"]["user_tc"]);
          $GLOBALS["driver"]->findElement(WebDriverBy::id("user_bas"))->clear()->sendKeys($GLOBALS["serv"]["user_bas"]);
          $GLOBALS["driver"]->findElement(WebDriverBy::id("user_haut"))->clear()->sendKeys($GLOBALS["serv"]["user_haut"]);
        }
        if ($GLOBALS["serv"]["snmp"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->click();
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp"))->isSelected()) {
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_user"))->clear()->sendKeys($GLOBALS["serv"]["snmp_user"]);
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_pass"))->clear()->sendKeys($GLOBALS["serv"]["snmp_pass"]);
          $encrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_encrypt")));
          $encrypt->selectByValue($GLOBALS["serv"]["snmp_encrypt"]);
          $GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_passpriv"))->clear()->sendKeys($GLOBALS["serv"]["snmp_passpriv"]);
          $privencrypt = new WebDriverSelect($GLOBALS["driver"]->findElement(WebDriverBy::id("snmp_privencrypt")));
          $privencrypt->selectByValue($GLOBALS["serv"]["snmp_privencrypt"]);
        }
        if ($GLOBALS["serv"]["syslog"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("syslog"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("syslog"))->click();
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("syslog"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("syslog_server"))->clear()->sendKeys($GLOBALS["serv"]["syslog_server"]);
        if ($GLOBALS["serv"]["ntp"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->click();
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("ntp"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("ntp_pool"))->clear()->sendKeys($GLOBALS["serv"]["ntp_pool"]);
        if ($GLOBALS["serv"]["antivirus"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus"))->click();
        if ($GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("antivirus_uri"))->clear()->sendKeys($GLOBALS["serv"]["antivirus_uri"]);
        if ($GLOBALS["serv"]["repo"] != $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->isSelected())
          $GLOBALS["driver"]->findElement(WebDriverBy::id("repo"))->click();
        save();
        apply();
        return true;
      }, true);
  }

  if ($what === "all" || $what === "cert") {
    //FIXME
  }

  if ($what === "all" || $what === "user") {
    //FIXME
  }

  if ($what === "all" || $what === "backup") {
    //FIXME
  }

  if ($what === "all" || $what === "task") {
    //FIXME
  }

} catch (Exception $e) {
  // Catch other errors here so that firefox is shut down cleanly
  echo $e->getMessage() . PHP_EOL;
  $driver->takeScreenshot("screenshot.png");
  echo "Screenshot of navigator avaiilable in file 'screenshot.png'" . PHP_EOL;
} finally {
  // Restore original XML configure file and apply it
  test("Restoring original configuration", function () {
      copy("/var/dsas/dsas_conf.xml.test", "/var/dsas/dsas_conf.xml"); 
      unlink("/var/dsas/dsas_conf.xml.test");
      apply();
      return true;
    });

  // Quit firefox instance
  $driver->quit();
}

?>
