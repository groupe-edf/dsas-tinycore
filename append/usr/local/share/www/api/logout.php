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

if (! dsas_loggedin(false, false))
  // No security risk here, trying to logout when not connected. Don't log it
  header("HTTP/1.0 403 Forbidden");
else {
  $cnxstr = $_SERVER["REMOTE_ADDR"];
  if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"]))
     $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_X_FORWARDED_FOR"] . "]";
  else if (!empty($_SERVER["HTTP_CLIENT_IP"]))
     $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_CLIENT_IP"] . "]";


  // Unset all of the session variables
  $_SESSION = array();

  // Destory the session
  session_destroy();

  syslog(LOG_NOTICE, "Succesful DSAS logout from " . $cnxstr);
  echo "ok";
}

?>
