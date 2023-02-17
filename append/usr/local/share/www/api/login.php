<?php
/**
 *    DSAS - Tinycore
 *    Copyright (C) 2021-2022  Electricite de France
 *
 *    This program is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation; either version 2 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License along
 *    with this program; if not, write to the Free Software Foundation, Inc.,
 *    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

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
        if (session_status() != PHP_SESSION_ACTIVE) {
            session_set_cookie_params(["secure" => true,
                                       "httponly" => true,
                                       "samesite" => "strict"]);
            session_start();
        }
 
        if ($newid = session_create_id("dsas-")) {
          // Store data in session variables
          $_SESSION["loggedin"] = true;
          $_SESSION["id"] = 0;
          $_SESSION["username"] = $username;
          $_SESSION["timestamp"] = time();
          session_commit();
          ini_set("session.use_strict_mode", "0");  // Allow new ID
          session_id($newid);
          syslog(LOG_WARNING, "Succesful DSAS login: USER=" . $username . " ; ADDR=" . $cnxstr);
          echo "Ok";
        } else {
          // This is not a security error but a server error
          syslog(LOG_WARNING, "Failed to create DSAS login session " . $cnxstr);
          header("HTTP/1.0 500 Internal Server Error");
        }
    } else {
        // Need to delay return if inactive or unrecognised user, to simulate the delay from PAM
        if (! dsas_user_active($username))
          sleep(3);
        syslog(LOG_WARNING, "Failed DSAS login: USER=" . $username . " ; ADDR=" . $cnxstr);
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
