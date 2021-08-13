<?php

require_once "common.php";

// Processing form data when form is submitted
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $username = trim($_POST["username"]);
    $password = trim($_POST["password"]);

    // Only the user 'tc' is allowed
    if ($username != "tc"){
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
            echo "Ok";
        } else
            die(header("HTTP/1.0 403 Forbidden"));
    }
} else {
   if (! dsas_loggedin())
     die(header("HTTP/1.0 403 Forbidden"));
   else
     echo "Ok";
}

?>
