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

if (! dsas_loggedin(true, false))
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
    $dsas = simplexml_load_file(_DSAS_XML);
    if ($dsas === false) {
      header("Content-Type: application/json");
      echo json_encode(["error" => "Error loading XML file"]);
      die();
    }
    /** @var array{username: string, passwd: string} $data */
    $data = json_decode($_POST["data"], true);
    $errors = array();
    if ($data["username"] != $_SESSION["username"])
      $errors[] = ["error" => ["Attempt to change password of a different user",  (string)$data["username"]]];
    else {
      $found = false;
      foreach ($dsas->config->users->user as $user) {
        if ($user->username == $data["username"]) {
          $found = true;
          $passwd = $data["passwd"];
          $name = $data["username"];
          if ($passwd != str_replace("/\s+/", "", $passwd))
            $errors[] = [$name => "The password can not contain white spaces"];
          else if (! complexity_test($passwd))
            $errors[] = [$name => "The password is insufficiently complex"];
          else {
            $ret = change_passwd($name, $passwd, $dsas->config->users->hash);
            if ($ret["retval"] != 0) {
              $errors[] = [$name => $ret["stderr"]];
            } else {
              if ($user->username == "tc")
                unset($dsas->config->users->first);

              // To make the password change permanent across a reboot need to backup
              // /etc/shadow on both machines. Can't use 'filetool.sh -b' for this as
              // unsaved changes by an adminstrator will also be backed up. Have to
              // untar the existing backup in tgz format, replace /etc/shadow and
              // rearchive it. This is going to be ugly !! Package the ugliness in a
              // script
              $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@haut", "/usr/local/sbin/dsaspasswd"]);
              if ($output["retval"] != 0)
                $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
              else {
                $output = dsas_exec(["/usr/local/sbin/dsaspasswd"]);
                if ($output["retval"] != 0)
                  $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
              }
            }
          }
          break;
        }
      }
      if (! $found)
        $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];
    }
    if ($dsas !== false && $errors == []) {
      $dsas->asXml(_DSAS_XML);
      echo "Ok";
    } else  {
      header("Content-Type: application/json");
      echo json_encode($errors);
    }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    header("HTTP/1.0 500 Internal Server Error");
  else {
    header("Content-Type: application/json");
    $i = 0;
    $found = false;
    foreach ($dsas->config->users->user as $user) {
      if ($user->username == $_SESSION["username"]) {
        $found = true;
        break;
      }
      $i++;
    }
    if ($found)
      echo json_encode($dsas->config->users->user[$i]);
  }
}

?>
