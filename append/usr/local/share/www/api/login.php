<?php

require_once "common.php";

// Processing form data when form is submitted
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $username = trim($_POST["username"]);
    $password = trim($_POST["password"]);

    $cnxstr = $_SERVER["REMOTE_ADDR"];
    if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"]))
       $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_X_FORWARDED_FOR"] . "]";
    else if (!empty($_SERVER["HTTP_CLIENT_IP"]))
       $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_CLIENT_IP"] . "]";

    if (dsas_user_active($username) && dsas_checkpass($username, $password)) {
        if (session_status() != PHP_SESSION_ACTIVE)
            session_start();
 
        $newid = session_create_id("dsas-");
  
        // Store data in session variables
        $_SESSION["loggedin"] = true;
        $_SESSION["id"] = 0;
        $_SESSION["username"] = $username;
        $_SESSION["timestamp"] = time();
        session_commit();
        ini_set("session.use_strict_mode", "0");  // Allow new ID
        session_id($newid);
        syslog(LOG_NOTICE, "Succesful DSAS login from " . $cnxstr);
        echo "Ok";
    } else {
        // Need to delay return if inactive or unrecognised user, to simulate the delay from PAM
        if (! dsas_user_active($username))
          sleep(3);
        syslog(LOG_WARNING, "Failed DSAS login attempt from " . $cnxstr);
        header("HTTP/1.0 403 Forbidden");
    }
} else {
   // No connection attempt so don't log anything to syslog
   $timeout =  (empty($_GET["timeout"]) || ($_GET["timeout"] === "true"));
   $admin =  (empty($_GET["admin"]) || ($_GET["admin"] === "true"));
   if (! dsas_loggedin($timeout, $admin))
     header("HTTP/1.0 403 Forbidden");
   else
     echo "Ok";
}

?>
