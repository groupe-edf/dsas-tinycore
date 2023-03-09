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

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
    $dsas = simplexml_load_file(_DSAS_XML);
    /** @var array{username: string, passwd: string, description: string, type: string, active: string, from: int, to: int} $data */
    $data = json_decode($_POST["data"], true);
    if ($dsas === false) {
      header("Content-Type: application/json");
      echo json_encode(["error" => "Error loading XML file"]);
      die();
    }
    $errors = array();
    switch ($_POST["op"]){
      case "add":
        $duser = $data["username"];
        if (! preg_match('/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/', $duser)) {
          $errors[] = ["error" => ["Username '{0}' is illegal", $duser]];
        } else {
          $found = false;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $duser) {
              $found = true;
              break;
            }
          }
          if ($found) {
            $errors[] = ["error" => ["The user '{0}' already exists",  $duser]];
          } else {
            $newuser = $dsas->config->users->addChild("user");
            $newuser->username = $duser;
            $newuser->description = "";
            $newuser->type = "admin";
            $newuser->active = "false";
            $output = dsas_exec(["sudo", "adduser", "-G", "users", "-h", _DSAS_HOME . "/" . $duser, "-s", "/bin/sh", "-D", $duser]);
            if ($output["retval"] != 0)
              $errors[] = ["error" => ["Error during user addition '{0}'", (string)$output["stderr"]]];
            dsas_exec(["sudo", "chmod", "go-rwx", _DSAS_HOME ."/" . $duser]);
          }
        }
        break;

      case "passwd":
        $found = false;
        foreach ($dsas->config->users->user as $user) {
          if ($user->username == $data["username"]) {
            $found = true;
            $name = $data["username"];
            $passwd = $data["passwd"];
            if ($passwd != str_replace("/\s+/", "", $passwd))
              $errors[] = [$name => "The password can not contain white spaces"];
            else if (! complexity_test($passwd))
              $errors[] = [$name => "The password is insufficently complex"];
            else {
              $ret = change_passwd($name, $passwd, $dsas->config->users->hash);
              if ($ret["retval"] != 0) {
                $errors[] = [$name => $ret["stderr"]];
              } else if ($name == "tc") {
                unset($dsas->config->users->first);
              }
            }
            break;
          }
        }
        if (! $found)
          $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];

        break;

      case "delete":
        if ($data["username"] === "tc") {
          $errors[] = [ "error" => "Can not remove the user 'tc'"];
        } else if ($data["username"] === $_SESSION["username"]) {
          $errors[] = [ "error" => ["Can not remove loggedin user '{0}'", $data["username"]]];
        } else {
          $found = false;
          $i = 0;
          foreach ($dsas->config->users->user as $user) {
            if ($user->username == $data["username"]) {
              $found = true;
              unset($dsas->config->users->user[$i]);
              $output = dsas_exec(["sudo", "deluser", "--remove-home", (string)$data["username"]]);
              if ($output["retval"] != 0) {
                $errors[] = ["error" => ["Error during user deletion '{0}'", (string)$output["stderr"]]];
                $dsas->asXml(_DSAS_XML); // Even if there is as error here, want to get rid of the user
              }
              break;
            }
            $i++;
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];
        }
        break;
     
      case "modify":
        /** @var array{username: string, passwd: string, description: string, type: string, active: string} $duser */  
        foreach ($data as $duser) {
          $found = false;
          $i = 0;         
          foreach ($dsas->config->users->user as $user) {
            if ($duser["username"] == $user->username) {
              $found = true;
              if ($duser["username"] != "tc" && $duser["username"] != $_SESSION["username"]) {
                $dsas->config->users->user[$i]->description = htmlspecialchars(trim((string)$duser["description"]));
                switch ($duser["type"]) {
                  case "admin":
                  case "bas":
                  case "haut":
                    $dsas->config->users->user[$i]->type = $duser["type"];
                    break;
                  default:
                    $errors[] = ["error" => ["User type '{0}' is illegal", $duser["type"]]];
                    break;
                }
              }
              $dsas->config->users->user[$i]->active = ($duser["active"] === "true" ? "true" : "false");
              break;
            }
            $i++;
          }
          if (! $found)
            $errors[] = ["error" => ["The user '{0}' does not exist",  $duser["username"]]];          
        }
        break;

      case "drag" :
        $from = $data["from"];
        $to = $data["to"];
        $nt =  $dsas->config->users[0]->count();
        if ($from < 1 || $to < 0 || $from > $nt - 1 || $to > $nt - 1) {
          $errors[] = ["error" => "The user drag is invalid"];
        } else  if ($from !== $to && $from !== $to + 1) {
          $user = new SimpleXMLElement($dsas->config->users[0]->user[$from]->asXML());
          $user_to = $dsas->config->users[0]->user[$to];
          unset($dsas->config->users->user[$from]);
          simplexml_insert_after($user, $user_to);
        }
        break;

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
    if ($errors == []) {
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
    echo json_encode($dsas->config->users);
  }
}

?>
