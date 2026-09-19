package game

func (m *Manager) joinLocked(room *Room, role string, reconnectToken string, playerName string, classID *int, seat *int, sender Sender) (JoinResult, error) {
	switch role {
	case RolePlayer:
		return room.joinPlayer(reconnectToken, playerName, classID, seat, sender)
	case RoleGameScreen:
		return room.joinGameScreen(reconnectToken, sender)
	default:
		return JoinResult{}, ErrInvalidRole
	}
}

func (r *Room) joinPlayer(reconnectToken string, playerName string, classID *int, seat *int, sender Sender) (JoinResult, error) {
	reconnected := false
	var player *Player
	if reconnectToken != "" {
		player = r.state.playerToken[reconnectToken]
	}
	if player != nil && player.Connected {
		player = nil
	}

	sessionToken := reconnectToken
	if sessionToken == "" || player == nil {
		token, err := playerReconnectToken(playerName, seat)
		if err != nil {
			return JoinResult{}, err
		}
		sessionToken = token
	}

	deviceID, err := randomID("dev")
	if err != nil {
		return JoinResult{}, err
	}

	if player == nil && seat != nil {
		if *seat < 0 || *seat >= r.MaxSeats {
			return JoinResult{}, ErrInvalidSeat
		}
		target := r.state.players[*seat]
		if target != nil && target.Connected {
			return JoinResult{}, ErrSeatOccupied
		}
		player = target
	}

	if player != nil {
		reconnected = reconnectToken != "" && player.Token == reconnectToken
		replaced := player.sender
		delete(r.state.playerToken, player.Token)
		player.Token = sessionToken
		player.DeviceID = deviceID
		if playerName != "" {
			player.Name = playerName
		}
		player.Connected = true
		player.sender = sender
		r.state.playerToken[player.Token] = player
		return r.joinSeatedPlayer(player, reconnected, replaced, sender)
	} else if seat != nil {
		if classID != nil && *classID < 0 {
			return JoinResult{}, ErrInvalidClass
		}
		player = &Player{
			Seat:     *seat,
			Token:    sessionToken,
			DeviceID: deviceID,
			Name:     playerName,
		}
		if classID != nil {
			if existing := r.state.playerClass[*classID]; existing != nil {
				return JoinResult{}, ErrClassTaken
			}
			classCopy := *classID
			player.ClassID = &classCopy
			r.state.playerClass[classCopy] = player
		}
		player.Connected = true
		player.sender = sender
		r.state.players[player.Seat] = player
		r.state.playerToken[player.Token] = player
		return r.joinSeatedPlayer(player, reconnected, nil, sender)
	}

	if player == nil {
		sessionID, err := randomID("sess")
		if err != nil {
			return JoinResult{}, err
		}
		session := &Session{
			ID:             sessionID,
			RoomCode:       r.Code,
			Role:           RolePlayer,
			DeviceID:       deviceID,
			ReconnectToken: sessionToken,
			PlayerName:     playerName,
			sender:         sender,
		}
		return JoinResult{
			Session:     session,
			Room:        r.snapshot(),
			Reconnected: false,
		}, nil
	}

	return r.joinSeatedPlayer(player, reconnected, nil, sender)
}

func (r *Room) joinSeatedPlayer(player *Player, reconnected bool, replaced Sender, sender Sender) (JoinResult, error) {
	sessionID, err := randomID("sess")
	if err != nil {
		return JoinResult{}, err
	}
	seat := player.Seat
	session := &Session{
		ID:             sessionID,
		RoomCode:       r.Code,
		Role:           RolePlayer,
		DeviceID:       player.DeviceID,
		Seat:           &seat,
		ClassID:        copyInt(player.ClassID),
		ReconnectToken: player.Token,
		PlayerName:     player.Name,
		sender:         sender,
	}

	return JoinResult{
		Session:     session,
		Room:        r.snapshot(),
		Reconnected: reconnected,
		replaced:    replaced,
	}, nil
}

func (r *Room) joinGameScreen(reconnectToken string, sender Sender) (JoinResult, error) {
	reconnected := false
	screen := r.state.screens[reconnectToken]
	if reconnectToken != "" && screen == nil {
		return JoinResult{}, ErrReconnectNotFound
	}

	if screen == nil {
		token, err := randomToken()
		if err != nil {
			return JoinResult{}, err
		}
		deviceID, err := randomID("screen")
		if err != nil {
			return JoinResult{}, err
		}
		screen = &GameScreen{
			Token:    token,
			DeviceID: deviceID,
		}
		r.state.screens[token] = screen
	} else {
		reconnected = true
	}

	replaced := screen.sender
	screen.Connected = true
	screen.sender = sender

	sessionID, err := randomID("sess")
	if err != nil {
		return JoinResult{}, err
	}
	session := &Session{
		ID:             sessionID,
		RoomCode:       r.Code,
		Role:           RoleGameScreen,
		DeviceID:       screen.DeviceID,
		ReconnectToken: screen.Token,
		sender:         sender,
	}

	return JoinResult{
		Session:     session,
		Room:        r.snapshot(),
		Reconnected: reconnected,
		replaced:    replaced,
	}, nil
}
