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

    // Only the user 'tc' is allowed
    if ($username != "tc"){
        syslog(LOG_WARNING, "Failed DSAS login attempt from " . $cnxstr );
        die(header("HTTP/1.0 403 Forbidden"));
    } else {
        if (sasl_checkpass($username, $password) == 0) {
            if (session_status() != PHP_SESSION_ACTIVE)
                session_start();
 
            $newid = session_create_id("dsas-");
  
            // Store data in session variables
            $_SESSION["loggedin"] = true;
            $_SESSION["id"] = 0;
            $_SESSION["username"] = $username;
            $_SESSION["timestamp"] = time();
            session_commit();
            ini_set("session.use_strict_mode", 0);  // Allow new ID
            session_id($newid);
            syslog(LOG_NOTICE, "Succesful DSAS login from " . $cnxstr);
            echo "Ok";
        } else {
            syslog(LOG_WARNING, "Failed DSAS login attempt from " . $cnxstr);
            die(header("HTTP/1.0 403 Forbidden"));
        }
    }
} else {
   // No connection attempt so don't log anything to syslog
   if (! empty($_GET["timeout"]) && (! $_GET["timeout"])) {
     if (! dsas_loggedin(false))
       die(header("HTTP/1.0 403 Forbidden"));
   } else if (! dsas_loggedin())
     die(header("HTTP/1.0 403 Forbidden"));
   else
     echo "Ok";
}

?>
